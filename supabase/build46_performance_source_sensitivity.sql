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
