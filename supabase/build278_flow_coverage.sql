-- Build278: unknown external-flow coverage is never confirmed by a zero,
-- small amount, or a single matching event. No ledger or NAV history changes.
alter table public.daily_performance_evidence alter column external_flow drop not null;

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
      case when ds.snapshot_at=p.fetched_at and p.balance_date=p.start_date+1
        then ds.external_flow else null end flow,
      case when ds.snapshot_at=p.fetched_at then
        ds.total_assets-ds.cash-ds.securities_value else null end end_component,
      case when base.snapshot_at=p.start_at then
        base.total_assets-base.cash-base.securities_value else null end start_component,
      b.difference_krw cash_gap,
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
      -- The current collector has no interval-bound completeness receipt for
      -- external cash AND security transfers, including zero-event intervals.
      -- Snapshot zero is a worker default; one matching ledger/adjustment row
      -- cannot prove no omitted events or their NAV reflection time. Fail closed
      -- until that independent source contract is implemented, for every amount.
      false flow_confirmed,
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
      case when e.flow is null then 'snapshot_external_flow_missing_or_unaligned' end,
      case when e.cash_gap is null then 'cash_bridge_evidence_missing' end,
      case when abs(e.cash_gap)>1 then 'cash_source_or_settlement_not_reconciled' end,
      case when not e.valuation_aligned then 'end_or_start_position_snapshot_at_different_time' end,
      case when e.flow<>0 then 'flow_timing_within_day_unknown_return_is_estimate' end,
      case when e.held_count>e.priced_count then 'some_historical_close_prices_missing' end,
      case when not e.flow_confirmed then 'external_flow_source_unconfirmed' end,
      'external_flow_interval_coverage_unverified',
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

-- Invalidate only derived certification/results from the old heuristic.
-- Preserve observed start/end NAV, recorded flow amounts and all source rows.
-- Re-running is idempotent; normal service refresh uses the corrected producer.
update public.daily_performance_evidence
set flow_source_confirmed=false,investment_pnl=null,rate_estimate_pct=null,
    quality='unavailable',
    limitations=limitations || '["external_flow_interval_coverage_unverified"]'::jsonb,
    calculated_at=now()
where flow_source_confirmed or investment_pnl is not null or rate_estimate_pct is not null
   or quality<>'unavailable'
   or not (limitations @> '["external_flow_interval_coverage_unverified"]'::jsonb);
