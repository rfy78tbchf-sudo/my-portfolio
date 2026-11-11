-- Build 46: record each observed NAV interval independently. A broker cash
-- balance with a different definition is evidence, never a P&L plug.
create table if not exists public.daily_performance_evidence (
  account_id uuid not null references public.accounts(id),
  source text not null,
  start_date date not null,
  end_date date not null,
  start_nav numeric not null,
  end_nav numeric not null,
  external_flow numeric not null,
  investment_pnl numeric,
  rate_estimate_pct numeric,
  quality text not null check (quality in ('confirmed','reconstructed','estimated','unavailable')),
  cash_bridge_gap numeric,
  nav_component_drift numeric,
  flow_source_confirmed boolean not null,
  snapshot_valuation_aligned boolean not null,
  price_coverage jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  primary key(account_id,source,start_date,end_date)
);
create index if not exists daily_performance_evidence_owner_date
  on public.daily_performance_evidence(account_id,end_date desc);
alter table public.daily_performance_evidence enable row level security;
create policy "Owner reads daily performance evidence" on public.daily_performance_evidence
  for select to authenticated using (exists (
    select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())
  ));
revoke all on public.daily_performance_evidence from public,anon,authenticated;
grant select on public.daily_performance_evidence to authenticated;
grant all on public.daily_performance_evidence to service_role;

create or replace function public.refresh_daily_performance_evidence_for_service(
  p_user_id uuid,p_from_date date default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_account uuid;v_count int;
begin
  select a.id into v_account from public.accounts a where a.user_id=p_user_id
    and a.mode='live' and a.is_active order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_LIVE_ACCOUNT'); end if;
  with observations as (
    select distinct on (o.source,o.balance_date)
      o.source,o.balance_date,o.fetched_at,o.total_assets_krw nav,o.cash_krw
    from public.account_observations o where o.account_id=v_account
      and o.total_assets_krw is not null and o.source in ('daily_snapshot_legacy','kb_current_snapshot')
    order by o.source,o.balance_date,o.fetched_at desc
  ), pairs as (
    select o.*,lag(o.balance_date) over(partition by o.source order by o.balance_date) start_date,
      lag(o.nav) over(partition by o.source order by o.balance_date) start_nav,
      lag(o.fetched_at) over(partition by o.source order by o.balance_date) start_at
    from observations o
  ), inputs as (
    select p.*,
      coalesce(ds.external_flow,0) flow,
      case when ds.snapshot_at=p.fetched_at then
        ds.total_assets-ds.cash-ds.securities_value else null end end_component,
      case when base.snapshot_at=p.start_at then
        base.total_assets-base.cash-base.securities_value else null end start_component,
      coalesce(b.difference_krw,0) cash_gap,
      coalesce((select count(*) from public.daily_security_snapshots h
        where h.account_id=v_account and h.snapshot_date=p.balance_date and h.quantity>0),0) held_count,
      coalesce((select count(*) from public.daily_security_snapshots h
        where h.account_id=v_account and h.snapshot_date=p.balance_date and h.quantity>0
          and exists(select 1 from public.daily_security_prices px
            where px.security_id=h.security_id and px.price_date=p.balance_date)),0) priced_count
    from pairs p
    left join public.daily_account_snapshots ds on ds.account_id=v_account
      and ds.snapshot_date=p.balance_date
    left join public.daily_account_snapshots base on base.account_id=v_account
      and base.snapshot_date=p.start_date
    left join public.live_cash_observation_bridges b on b.account_id=v_account
      and b.start_date=p.start_date and b.end_date=p.balance_date
    where p.start_date is not null and p.balance_date>=coalesce(p_from_date,'1900-01-01'::date)
  ), evidence as (
    select i.*,
      (abs(i.flow)<=1 or exists (
        select 1 from public.cash_flows c where c.account_id=v_account
          and c.currency='KRW' and c.amount=i.flow
          and (c.occurred_at at time zone 'Asia/Seoul')::date between i.balance_date-1 and i.balance_date
      ) or exists (
        select 1 from public.manual_adjustments m where m.account_id=v_account
          and m.user_id=p_user_id and m.active and m.kind='external_flow'
          and m.amount=i.flow and m.occurred_on between i.balance_date-1 and i.balance_date
      )) flow_confirmed,
      (i.start_component is not null and i.end_component is not null) valuation_aligned,
      case when i.start_component is not null and i.end_component is not null
        then i.end_component-i.start_component else null end component_drift
    from inputs i
  )
  insert into public.daily_performance_evidence as current_row (
    account_id,source,start_date,end_date,start_nav,end_nav,external_flow,
    investment_pnl,rate_estimate_pct,quality,cash_bridge_gap,nav_component_drift,
    flow_source_confirmed,snapshot_valuation_aligned,price_coverage,limitations,calculated_at)
  select v_account,e.source,e.start_date,e.balance_date,e.start_nav,e.nav,e.flow,
    case when e.flow_confirmed and (e.component_drift is null or abs(e.component_drift)<=1)
      then e.nav-e.start_nav-e.flow else null end,
    case when e.flow_confirmed and (e.component_drift is null or abs(e.component_drift)<=1)
       and e.start_nav>0 and (e.nav-e.flow)>0
      then round(((e.nav-e.flow)/e.start_nav-1)*100,4) else null end,
    case when not e.flow_confirmed or
      (e.component_drift is not null and abs(e.component_drift)>1) then 'unavailable'
      when abs(e.cash_gap)<=1 and e.valuation_aligned and e.held_count=e.priced_count
        and e.flow=0 then 'reconstructed'
      else 'estimated' end,
    e.cash_gap,e.component_drift,e.flow_confirmed,e.valuation_aligned,
    jsonb_build_object('held',e.held_count,'same_day_price_rows',e.priced_count,
      'position_valuation','KB account snapshot; not a complete daily price series'),
    to_jsonb(array_remove(array[
      case when abs(e.cash_gap)>1 then 'cash_source_or_settlement_not_reconciled' end,
      case when not e.valuation_aligned then 'end_or_start_position_snapshot_at_different_time' end,
      case when e.flow<>0 then 'flow_timing_within_day_unknown_return_is_estimate' end,
      case when e.held_count>e.priced_count then 'some_historical_close_prices_missing' end,
      case when not e.flow_confirmed then 'external_flow_source_unconfirmed' end,
      case when e.component_drift is not null and abs(e.component_drift)>1
        then 'asset_components_changed_without_explanation' end
    ]::text[],null)),now()
  from evidence e
  on conflict(account_id,source,start_date,end_date) do update set
    start_nav=excluded.start_nav,end_nav=excluded.end_nav,external_flow=excluded.external_flow,
    investment_pnl=excluded.investment_pnl,rate_estimate_pct=excluded.rate_estimate_pct,
    quality=excluded.quality,cash_bridge_gap=excluded.cash_bridge_gap,
    nav_component_drift=excluded.nav_component_drift,
    flow_source_confirmed=excluded.flow_source_confirmed,
    snapshot_valuation_aligned=excluded.snapshot_valuation_aligned,
    price_coverage=excluded.price_coverage,limitations=excluded.limitations,
    calculated_at=excluded.calculated_at;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'intervals_refreshed',v_count);
end $fn$;
revoke all on function public.refresh_daily_performance_evidence_for_service(uuid,date)
  from public,anon,authenticated;
grant execute on function public.refresh_daily_performance_evidence_for_service(uuid,date) to service_role;

-- Return the latest contiguous evidence window for the requested period.
-- Earlier unavailable intervals do not veto a later independently verifiable window.
create or replace function public.get_live_reliable_performance(p_period text default '1M')
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_account uuid;v_start date;v_today date:=timezone('Asia/Seoul',now())::date;
  v_source text;v_end date;v_anchor date;v_first_ledger date;
  v_total numeric;v_flow numeric;v_base numeric;v_finish numeric;v_count int;v_chain_gaps int;
  v_rate numeric;v_partial boolean;v_gaps int;v_quality text;v_cash_gaps int;
  v_limitations jsonb;v_source_gap numeric;
begin
  select a.id into v_account from public.accounts a where a.user_id=(select auth.uid())
    and a.mode='live' and a.is_active order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_LIVE_ACCOUNT'); end if;
  select min((t.trade_at at time zone 'Asia/Seoul')::date) into v_first_ledger
    from public.transactions t where t.account_id=v_account;
  v_start:=case upper(coalesce(p_period,'1M'))
    when '오늘' then v_today-1 when 'TODAY' then v_today-1
    when '1W' then v_today-7 when '1M' then (v_today-interval '1 month')::date
    when '3M' then (v_today-interval '3 months')::date
    when '6M' then (v_today-interval '6 months')::date
    when 'YTD' then make_date(extract(year from v_today)::integer,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    when 'ALL' then coalesce(v_first_ledger,v_today)
    else null end;
  if v_start is null then return jsonb_build_object('ok',false,'reason','INVALID_PERIOD'); end if;
  select e.source,max(e.end_date) into v_source,v_end
  from public.daily_performance_evidence e where e.account_id=v_account
  group by e.source order by max(e.end_date) desc,
    (e.source='kb_current_snapshot') desc limit 1;
  if v_end is null then return jsonb_build_object('ok',true,'state','unavailable',
    'requested_start',v_start,'reason','TWO_COMPARABLE_NAV_DATES_REQUIRED'); end if;
  -- A broken day cuts the chain. A source with only one day cannot masquerade
  -- as the continuation of another source's valuation basis.
  select max(e.end_date) into v_anchor from public.daily_performance_evidence e
    where e.account_id=v_account and e.source=v_source
      and e.quality='unavailable' and e.end_date<=v_end;
  select min(e.start_date) into v_anchor from public.daily_performance_evidence e
    where e.account_id=v_account and e.source=v_source
      and e.quality<>'unavailable' and e.start_date>=greatest(v_start,coalesce(v_anchor,v_start));
  if v_anchor is null then return jsonb_build_object('ok',true,'state','unavailable',
    'requested_start',v_start,'reason','NO_VALID_OBSERVED_INTERVAL',
    'source',v_source,'observed_through',v_end); end if;
  select count(*),sum(e.investment_pnl),sum(e.external_flow),
    max(e.start_nav) filter(where e.start_date=v_anchor),
    max(e.end_nav) filter(where e.end_date=v_end),
    count(*) filter(where e.quality='unavailable'),
    count(*) filter(where abs(e.cash_bridge_gap)>1),
    case when bool_and(e.quality='confirmed') then 'confirmed'
      when bool_and(e.quality in ('confirmed','reconstructed')) then 'reconstructed'
      else 'estimated' end
    into v_count,v_total,v_flow,v_base,v_finish,v_gaps,v_cash_gaps,v_quality
  from public.daily_performance_evidence e
  where e.account_id=v_account and e.source=v_source
    and e.start_date>=v_anchor and e.end_date<=v_end;
  select count(*) into v_chain_gaps from (
    select e.start_date,lag(e.end_date) over(order by e.start_date) previous_end
    from public.daily_performance_evidence e where e.account_id=v_account
      and e.source=v_source and e.start_date>=v_anchor and e.end_date<=v_end
  ) consecutive where consecutive.previous_end is not null
    and consecutive.previous_end<>consecutive.start_date;
  select coalesce(jsonb_agg(distinct x.note) filter(where x.note is not null),'[]'::jsonb)
    into v_limitations
  from public.daily_performance_evidence e
  left join lateral jsonb_array_elements_text(e.limitations) as x(note) on true
  where e.account_id=v_account and e.source=v_source
    and e.start_date>=v_anchor and e.end_date<=v_end;
  if v_count=0 or v_gaps>0 or v_chain_gaps>0 or v_base is null or v_finish is null then
    return jsonb_build_object('ok',true,'state','unavailable','requested_start',v_start,
      'reason','CONTINUOUS_EVIDENCE_REQUIRED','observed_through',v_end); end if;
  -- Daily linking assumes each cash flow arrived at the end of its observed
  -- interval. This is an estimate whenever the exact reflected time is unknown.
  select case when count(*)=0 or bool_or(1+investment_pnl/start_nav<=0) then null
    else round(((exp(sum(ln((1+investment_pnl/start_nav)::double precision)))-1)*100)::numeric,4) end
    into v_rate
  from public.daily_performance_evidence
  where account_id=v_account and source=v_source and start_date>=v_anchor and end_date<=v_end
    and investment_pnl is not null and start_nav>0;
  v_partial:=v_anchor>v_start;
  select o.total_assets_krw-v_finish into v_source_gap
  from public.account_observations o
  where o.account_id=v_account and o.balance_date=v_end and o.source<>v_source
    and o.total_assets_krw is not null
  order by o.fetched_at desc limit 1;
  return jsonb_build_object('ok',true,'state',v_quality,'requested_period',p_period,
    'requested_start',v_start,'reliable_start',v_anchor,'observed_through',v_end,
    'as_of',(select max(o.fetched_at) from public.account_observations o
      where o.account_id=v_account and o.source=v_source and o.balance_date=v_end),
    'source',v_source,'partial',v_partial,'intervals',v_count,
    'opening_assets',v_base,'closing_assets',v_finish,'external_flow',v_flow,
    'investment_pnl',v_total,'return_estimate_pct',v_rate,
    'twr_pct',case when v_flow=0 and v_cash_gaps=0 and v_quality<>'estimated'
      then v_rate else null end,
    'cash_gap_intervals',v_cash_gaps,'limitations',v_limitations,
    'same_day_other_source_nav_gap_krw',v_source_gap,
    'latest_official_nav',(select o.total_assets_krw from public.account_observations o
      where o.account_id=v_account order by o.fetched_at desc limit 1));
end $fn$;
revoke all on function public.get_live_reliable_performance(text) from public,anon;
grant execute on function public.get_live_reliable_performance(text) to authenticated;
