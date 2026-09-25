-- Read-only post-sync audit. Every row must report violations = 0.
with chronological as (
  select s.account_id,s.snapshot_date,s.snapshot_at,s.total_assets,s.external_flow,
    lag(s.snapshot_date) over(partition by s.account_id order by s.snapshot_date) prev_date,
    lag(s.snapshot_at) over(partition by s.account_id order by s.snapshot_date) prev_at,
    lag(s.total_assets) over(partition by s.account_id order by s.snapshot_date) prev_assets
  from public.daily_account_snapshots s
), expected as (
  select s.*,
    public.allocated_external_flow(s.account_id,s.prev_at,s.prev_date,
      s.snapshot_at,s.snapshot_date)
    + coalesce((select sum(m.amount) from public.manual_adjustments m
      where m.account_id=s.account_id and m.active and m.kind='external_flow'
        and m.occurred_on>coalesce(s.prev_date,s.snapshot_date-1)
        and m.occurred_on<=s.snapshot_date),0) as expected_flow
  from chronological s
)
select 'cash flow enters exactly one balance interval' as check_name,
  count(*) as violations from expected where external_flow is distinct from expected_flow
union all
select 'daily profit excludes external flow',
  count(*) from expected e join public.portfolio_performance p
    on p.account_id=e.account_id and p.performance_date=e.snapshot_date
  where p.daily_pnl is distinct from e.total_assets-e.prev_assets-e.external_flow
union all
select 'cash flow has exactly one provider identity',
  count(*) from (
    select account_id,external_id from public.cash_flows
    group by account_id,external_id having count(*)<>1
  ) duplicates
union all
select 'no currency conversions classified as stock trades',
  count(*) from public.transactions t where t.type in ('buy','sell')
    and t.security_id is null and t.quantity is null
    and coalesce(t.provider_payload->>'smry_nm','') ~ '환전|외화매수|외화매도'
union all
select 'cash flow links to its original ledger entry',
  count(*) from public.cash_flows c where c.source='api'
    and not exists (select 1 from public.transactions t
      where t.account_id=c.account_id and t.external_id=c.external_id
        and t.type=c.type);
