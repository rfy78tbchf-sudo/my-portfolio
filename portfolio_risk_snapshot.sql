-- A transparent risk inventory of saved KB positions. Manual ISA assets and
-- securities without a current holding are not silently assigned to sectors.
create or replace function public.get_live_risk_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
with account as (
  select a.id from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
  order by a.created_at limit 1
), latest as (
  select s.total_assets,s.securities_value,s.snapshot_at from public.daily_account_snapshots s
  where s.account_id=(select id from account)
  order by s.snapshot_date desc limit 1
), positions as (
  select h.security_id,s.symbol,s.name,s.sector,s.country,h.currency,
    greatest(0,coalesce(h.market_value,0)*coalesce(h.fx_rate_to_base,1)) krw
  from public.holdings h join public.securities s on s.id=h.security_id
  where h.account_id=(select id from account) and h.quantity>0
), sorted as (
  select *,row_number() over(order by krw desc,security_id) rank from positions
), sums as (
  select count(*) position_count,coalesce(sum(krw),0) known_value,
    coalesce(sum(krw) filter(where currency<>'KRW'),0) foreign_value,
    coalesce(sum(krw) filter(where upper(symbol) in ('SOXL','SOXS','TQQQ','SQQQ','UPRO','SPXU')),0) leveraged_value,
    coalesce(sum(krw) filter(where sector is null or trim(sector)=''),0) unclassified_value,
    coalesce(sum(krw) filter(where rank<=3),0) top_three_value,
    coalesce(max(krw) filter(where rank=1),0) largest_value,
    (array_agg(symbol order by rank))[1] largest_symbol
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
  'coverage_pct',case when coalesce((select securities_value from latest),0)>0
    then round(sums.known_value/(select securities_value from latest)*100,1) else null end
) from sums;
$$;
revoke all on function public.get_live_risk_snapshot() from public,anon;
grant execute on function public.get_live_risk_snapshot() to authenticated;
