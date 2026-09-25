-- Build 47: report the valuation cutoffs separately; never combine a legacy
-- daily NAV with a later current-account NAV as though they were simultaneous.
create or replace function public.get_live_observation_cutoffs()
returns jsonb language sql stable security invoker set search_path='' as $fn$
with own as (
  select id from public.accounts where user_id=(select auth.uid())
    and mode='live' and is_active order by created_at limit 1
), latest as (
  select distinct on (o.source) o.source,o.balance_date,o.fetched_at,
    o.total_assets_krw nav,o.cash_krw cash
  from public.account_observations o join own a on a.id=o.account_id
  where o.source in ('daily_snapshot_legacy','kb_current_snapshot')
  order by o.source,o.fetched_at desc
), pair as (
  select (select row_to_json(x) from latest x where source='daily_snapshot_legacy') legacy,
    (select row_to_json(x) from latest x where source='kb_current_snapshot') current
)
select jsonb_build_object('ok',exists(select 1 from own),
  'legacy',legacy,'current',current,
  'nav_gap_krw',case when (legacy->>'balance_date')=(current->>'balance_date')
    then (current->>'nav')::numeric-(legacy->>'nav')::numeric else null end,
  'cash_gap_krw',case when (legacy->>'balance_date')=(current->>'balance_date')
    then (current->>'cash')::numeric-(legacy->>'cash')::numeric else null end,
  'same_day',coalesce((legacy->>'balance_date')=(current->>'balance_date'),false),
  'valuation_time_aligned',coalesce((legacy->>'fetched_at')=(current->>'fetched_at'),false))
from pair;
$fn$;
revoke all on function public.get_live_observation_cutoffs() from public,anon;
grant execute on function public.get_live_observation_cutoffs() to authenticated;

-- The weekday denominator is a diagnostic: exchange holidays are not trading
-- days, so this approximate missing ratio is not a release gate.
create or replace function public.get_live_price_lifecycle_coverage()
returns jsonb language sql stable security invoker set search_path='' as $fn$
with own as (
  select id from public.accounts where user_id=(select auth.uid())
    and mode='live' and is_active order by created_at limit 1
), traded as (
  select t.security_id,min((t.trade_at at time zone 'Asia/Seoul')::date) first_trade,
    max((t.trade_at at time zone 'Asia/Seoul')::date) last_trade
  from public.transactions t join own a on a.id=t.account_id
  where t.security_id is not null and t.type in ('buy','sell')
  group by t.security_id
), price as (
  select p.security_id,min(p.price_date) first_price,max(p.price_date) last_price,
    count(distinct p.price_date) price_days,
    count(distinct p.price_date) filter(where p.price_date between t.first_trade and t.last_trade) trade_window_days,
    count(distinct p.price_date) filter(where p.price_date=t.first_trade) first_day_present,
    count(distinct p.price_date) filter(where p.price_date=t.last_trade) last_day_present
  from traded t left join public.daily_security_prices p on p.security_id=t.security_id
  group by p.security_id,t.first_trade,t.last_trade
), coverage as (
  select s.symbol,s.name,s.market,t.first_trade,t.last_trade,p.first_price,p.last_price,
    coalesce(p.price_days,0) price_days,coalesce(p.trade_window_days,0) trade_window_days,
    coalesce(p.first_day_present,0)>0 first_day_present,coalesce(p.last_day_present,0)>0 last_day_present,
    ((t.last_trade-t.first_trade+1)/7*5 +
      (select count(*) from generate_series(t.first_trade+((t.last_trade-t.first_trade+1)/7*7),t.last_trade,'1 day'::interval) d
         where extract(isodow from d)<6))::int approx_weekdays
  from traded t join public.securities s on s.id=t.security_id
  left join price p on p.security_id=t.security_id
)
select jsonb_build_object('ok',true,'traded_symbols',count(*),
  'priced_symbols',count(*) filter(where price_days>0),
  'first_trade_covered',count(*) filter(where first_price<=first_trade),
  'last_trade_covered',count(*) filter(where last_price>=last_trade),
  'unpriced_symbols',count(*) filter(where price_days=0),
  'diagnostic_note','평일 대비 결측 비율은 거래소 휴장일을 포함한 대략적 점검값이며 성과 공개 기준이 아닙니다.',
  'items',coalesce(jsonb_agg(jsonb_build_object(
    'symbol',symbol,'name',name,'market',market,'first_trade',first_trade,
    'last_trade',last_trade,'first_price',first_price,'last_price',last_price,
    'price_days',price_days,'trade_window_days',trade_window_days,
    'first_day_present',first_day_present,'last_day_present',last_day_present,
    'approx_weekdays',approx_weekdays,
    'approx_missing_ratio',case when approx_weekdays>0 then
      round(greatest(0,1-trade_window_days::numeric/approx_weekdays),3) else null end
  ) order by first_trade,symbol),'[]'::jsonb)) from coverage;
$fn$;
revoke all on function public.get_live_price_lifecycle_coverage() from public,anon;
grant execute on function public.get_live_price_lifecycle_coverage() to authenticated;
