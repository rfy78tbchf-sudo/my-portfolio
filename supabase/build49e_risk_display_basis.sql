-- Match the risk numerator to the exact position valuation used by the
-- portfolio list. The saved snapshot is the app display total and can include
-- a manual ISA overlay; callers must not label it the raw KB response total.
create or replace function public.get_live_risk_snapshot()
returns jsonb language sql stable set search_path to '' as $$
with account as (
  select a.id from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live'
    and a.provider='kb_securities' and a.is_active
  order by a.created_at limit 1
), latest as (
  select s.total_assets,s.securities_value,s.snapshot_at from public.daily_account_snapshots s
  where s.account_id=(select id from account)
  order by s.snapshot_at desc limit 1
), positions as (
  select v.security_id,s.symbol,s.sector,v.currency,v.as_of,
    greatest(0,coalesce(v.valuation_krw,0)) krw
  from public.live_holding_display_basis v
  join public.securities s on s.id=v.security_id
  where v.account_id=(select id from account) and v.quantity>0
), sorted as (
  select *,row_number() over(order by krw desc,security_id) rank from positions
), sums as (
  select count(*) position_count,coalesce(sum(krw),0) known_value,
    coalesce(sum(krw) filter(where currency<>'KRW'),0) foreign_value,
    coalesce(sum(krw) filter(where upper(symbol) in ('SOXL','SOXS','TQQQ','SQQQ','UPRO','SPXU')),0) leveraged_value,
    coalesce(sum(krw) filter(where sector is null or trim(sector)=''),0) unclassified_value,
    coalesce(sum(krw) filter(where rank<=3),0) top_three_value,
    coalesce(max(krw) filter(where rank=1),0) largest_value,
    (array_agg(symbol order by rank))[1] largest_symbol,
    min(as_of) positions_as_of_min,max(as_of) positions_as_of_max
  from sorted
)
select jsonb_build_object(
  'ok',true,'as_of',(select snapshot_at from latest),
  'position_count',sums.position_count,'known_positions_krw',sums.known_value,
  'official_securities_krw',coalesce((select securities_value from latest),0),
  'official_assets_krw',coalesce((select total_assets from latest),0),
  'largest_symbol',sums.largest_symbol,'largest_krw',sums.largest_value,
  'top_three_krw',sums.top_three_value,
  'foreign_currency_krw',sums.foreign_value,
  'leveraged_etf_krw',sums.leveraged_value,
  'sector_unclassified_krw',sums.unclassified_value,
  'positions_as_of_min',sums.positions_as_of_min,
  'positions_as_of_max',sums.positions_as_of_max,
  'valuation_time_aligned',coalesce(sums.positions_as_of_min=(select snapshot_at from latest)
    and sums.positions_as_of_max=(select snapshot_at from latest),false),
  'valuation_basis','live_holding_display_basis',
  -- The denominator is the app display securities amount (may include ISA).
  -- This is a descriptive ratio, never completeness of KB positions.
  'coverage_pct',case when coalesce((select securities_value from latest),0)>0
    then round(sums.known_value/(select securities_value from latest)*100,1) else null end
) from sums;
$$;
