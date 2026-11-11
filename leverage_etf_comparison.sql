-- Market instrument comparison, not the account's personal SOXL trade return.
create or replace function public.get_leverage_etf_comparison(p_period text default '1M')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_today date:=(now() at time zone 'Asia/Seoul')::date;
  v_requested date;
  v_anchor date;
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  v_requested:=case upper(coalesce(p_period,'1M'))
    when '오늘' then v_today-1 when 'TODAY' then v_today-1
    when '1W' then v_today-7 when '1M' then (v_today-interval '1 month')::date
    when '3M' then (v_today-interval '3 months')::date
    when 'YTD' then make_date(extract(year from v_today)::int,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    else (v_today-interval '1 month')::date end;
  select max(p.price_date) into v_anchor
    from public.daily_security_prices p join public.securities s on s.id=p.security_id
    where s.symbol='SOXX' and p.price_date<=v_requested and p.price_date>=v_requested-7;
  if v_anchor is null then
    return jsonb_build_object('ok',true,'ready',false,'reason','SOXX 시작일 종가가 부족합니다');
  end if;
  with paired as (
    select p.price_date,
      max(p.close) filter(where s.symbol='SOXX') base,
      max(p.close) filter(where s.symbol='SOXL') leveraged
    from public.daily_security_prices p join public.securities s on s.id=p.security_id
    where s.symbol in ('SOXX','SOXL') and p.price_date between v_anchor and v_today
      and p.close>0 group by p.price_date
    having count(distinct s.symbol)=2
  ), daily as (
    select *,lag(base) over(order by price_date) prev_base,
      max(base) over(order by price_date rows between unbounded preceding and current row) peak_base,
      max(leveraged) over(order by price_date rows between unbounded preceding and current row) peak_lever
    from paired
  ), agg as (
    select count(*) n,min(price_date) first_day,max(price_date) last_day,
      (array_agg(base order by price_date))[1] first_base,
      (array_agg(base order by price_date desc))[1] last_base,
      (array_agg(leveraged order by price_date))[1] first_lever,
      (array_agg(leveraged order by price_date desc))[1] last_lever,
      min(base/peak_base-1) max_drawdown_base,
      min(leveraged/peak_lever-1) max_drawdown_lever,
      case when bool_or(prev_base is not null and (1+3*(base/prev_base-1))<=0)
        then null
        else exp(sum(ln(case when prev_base is not null
          and 1+3*(base/prev_base-1)>0
          then (1+3*(base/prev_base-1))::double precision end))) - 1 end theoretical_3x
    from daily
  )
  select jsonb_build_object('ok',true,'ready',agg.n>=2 and agg.first_day=v_anchor,
    'first_date',agg.first_day,'last_date',agg.last_day,'common_price_days',agg.n,
    'soxx_pct',(agg.last_base/agg.first_base-1)*100,
    'soxl_pct',(agg.last_lever/agg.first_lever-1)*100,
    'daily_3x_compounded_pct',agg.theoretical_3x*100,
    'compounding_vs_simple_pct',(agg.theoretical_3x-3*(agg.last_base/agg.first_base-1))*100,
    'tracking_difference_pct',((agg.last_lever/agg.first_lever-1)-agg.theoretical_3x)*100,
    'soxx_max_drawdown_pct',agg.max_drawdown_base*100,
    'soxl_max_drawdown_pct',agg.max_drawdown_lever*100,
    'reason',case when agg.n<2 then 'SOXL·SOXX 공통 종가 2일 이상 필요'
      when agg.first_day<>v_anchor then '시작일 SOXL 종가가 부족합니다'
      else null end)
  into v_result from agg;
  return v_result;
end $$;
revoke all on function public.get_leverage_etf_comparison(text) from public,anon;
grant execute on function public.get_leverage_etf_comparison(text) to authenticated;
