-- An explanation is kept separate from the immutable observed minus ledger
-- difference. No reconciliation adjustment is posted to transactions or P&L.
create or replace view public.live_cash_case_assessments
with (security_invoker=true) as
with cases as (
  select e.account_id,e.start_date,e.end_date,e.difference_krw,e.status,
    (select o.source from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.start_date
        and o.cash_krw is not null order by o.fetched_at desc limit 1) opening_source,
    (select o.source from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.end_date
        and o.cash_krw is not null order by o.fetched_at desc limit 1) closing_source,
    coalesce((select sum(x.amount) from public.live_cash_ledger_events x
      where x.account_id=e.account_id and x.currency='KRW' and x.event_type='fx'
        and x.event_date>e.start_date and x.event_date<=e.end_date),0) fx_trade_date_krw,
    coalesce((select sum(c.amount) from public.cash_flows c
      where c.account_id=e.account_id and c.source='api' and c.currency='KRW'
        and (c.occurred_at at time zone 'Asia/Seoul')::date=e.end_date
        and exists(select 1 from public.daily_account_snapshots s
          where s.account_id=e.account_id and s.snapshot_date=e.end_date+1
            and s.external_flow=c.amount)),0) deposit_excluded_until_next_day,
    coalesce((select sum(c.amount) from public.cash_flows c
      where c.account_id=e.account_id and c.source='api' and c.currency='KRW'
        and (c.occurred_at at time zone 'Asia/Seoul')::date=e.start_date
        and exists(select 1 from public.daily_account_snapshots s
          where s.account_id=e.account_id and s.snapshot_date=e.end_date
            and s.external_flow=c.amount)),0) prior_day_deposit_reflected_today,
    (select o.cash_krw from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.end_date
        and o.source='daily_snapshot_legacy' order by o.fetched_at desc limit 1) legacy_closing_cash,
    (select o.cash_krw from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.end_date
        and o.source='kb_current_snapshot' order by o.fetched_at desc limit 1) current_closing_cash,
    (select o.total_assets_krw from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.end_date
        and o.source='daily_snapshot_legacy' order by o.fetched_at desc limit 1) legacy_closing_nav,
    (select o.total_assets_krw from public.account_observations o
      where o.account_id=e.account_id and o.balance_date=e.end_date
        and o.source='kb_current_snapshot' order by o.fetched_at desc limit 1) current_closing_nav
  from public.cash_reconciliation_errors e
)
select c.account_id,c.start_date,c.end_date,c.difference_krw,c.status,
  c.opening_source,c.closing_source,c.fx_trade_date_krw,
  c.deposit_excluded_until_next_day,c.prior_day_deposit_reflected_today,
  c.difference_krw+c.deposit_excluded_until_next_day-c.prior_day_deposit_reflected_today
    remaining_difference_krw,
  c.current_closing_cash-c.legacy_closing_cash same_day_cash_source_delta,
  c.current_closing_nav-c.legacy_closing_nav same_day_nav_source_delta,
  case when c.status='resolved' then 'resolved'
    when c.opening_source is distinct from c.closing_source then 'source_basis_conflict'
    when c.deposit_excluded_until_next_day<>0 or c.prior_day_deposit_reflected_today<>0
      then 'partially_explained_reflection_delay'
    when c.fx_trade_date_krw<>0 then 'fx_or_settlement_timing_unverified'
    else 'source_data_insufficient' end cause_classification
from cases c;
revoke all on public.live_cash_case_assessments from public,anon;
grant select on public.live_cash_case_assessments to authenticated;
