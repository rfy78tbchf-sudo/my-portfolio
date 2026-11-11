-- An investable reference only when both account balances and both FX-adjusted
-- benchmark closes cover the exact comparison interval.
create or replace function public.get_live_benchmark_comparison(
  p_period text default '1M',p_symbol text default 'SOXX')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_perf jsonb;
  v_start date;
  v_end date;
  v_start_price_limit date;
  v_end_price_limit date;
  v_start_close record;
  v_end_close record;
  v_start_fx numeric;
  v_end_fx numeric;
  v_start_fx_source text;
  v_end_fx_source text;
  v_return numeric;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  v_perf:=public.get_live_performance_summary(p_period);
  if v_perf->>'return_ready' is distinct from 'true'
     or (v_perf->>'start_snapshot_date')::date>(v_perf->>'period_start')::date then
    return jsonb_build_object('ok',true,'ready',false,
      'reason','선택 기간 전체의 실제 계좌 시작 잔고가 없습니다');
  end if;
  v_start:=(v_perf->>'start_snapshot_date')::date;
  v_end:=(v_perf->>'end_snapshot_date')::date;
  -- A saved Korean daytime balance precedes the close of that day's US session.
  select case when (snapshot_at at time zone 'Asia/Seoul')::time>=time '06:30'
    then snapshot_date-1 else snapshot_date-2 end into v_start_price_limit
    from public.daily_account_snapshots where snapshot_date=v_start
      and account_id=(select id from public.accounts
        where user_id=(select auth.uid()) and mode='live' and is_active
        order by created_at limit 1);
  select case when (snapshot_at at time zone 'Asia/Seoul')::time>=time '06:30'
    then snapshot_date-1 else snapshot_date-2 end into v_end_price_limit
    from public.daily_account_snapshots where snapshot_date=v_end
      and account_id=(select id from public.accounts
        where user_id=(select auth.uid()) and mode='live' and is_active
        order by created_at limit 1);
  select p.price_date,p.close into v_start_close
    from public.daily_security_prices p join public.securities s on s.id=p.security_id
    where s.symbol=upper(p_symbol) and p.price_date between v_start_price_limit-7 and v_start_price_limit
      and p.close>0
    order by p.price_date desc limit 1;
  select p.price_date,p.close into v_end_close
    from public.daily_security_prices p join public.securities s on s.id=p.security_id
    where s.symbol=upper(p_symbol) and p.price_date between v_end_price_limit-3 and v_end_price_limit
      and p.close>0
    order by p.price_date desc limit 1;
  if v_start_close.close is null or v_end_close.close is null
     or v_end_close.price_date<=v_start_close.price_date then
    return jsonb_build_object('ok',true,'ready',false,'symbol',p_symbol,
      'reason','비교 가능한 시작일·종료일 종가가 아직 없습니다');
  end if;
  select f.rate,f.source into v_start_fx,v_start_fx_source from public.fx_rates f
    where f.base_currency='USD' and f.quote_currency='KRW'
      and f.rate_date between v_start-7 and v_start
      and f.rate>0 order by f.rate_date desc,
        case when f.source='kb_account_snapshot' then 0 else 1 end limit 1;
  select f.rate,f.source into v_end_fx,v_end_fx_source from public.fx_rates f
    where f.base_currency='USD' and f.quote_currency='KRW'
      and f.rate_date between v_end-7 and v_end
      and f.rate>0 order by f.rate_date desc,
        case when f.source='kb_account_snapshot' then 0 else 1 end limit 1;
  if v_start_fx is null or v_end_fx is null then
    return jsonb_build_object('ok',true,'ready',false,'symbol',p_symbol,
      'reason','당시 원/달러 환율이 부족해 원화 투자성과와 비교하지 않습니다');
  end if;
  v_return:=(v_end_close.close*v_end_fx)/(v_start_close.close*v_start_fx)*100-100;
  return jsonb_build_object('ok',true,'ready',true,'symbol',upper(p_symbol),
    'account_start',v_start,'account_end',v_end,
    'price_start_date',v_start_close.price_date,
    'price_end_date',v_end_close.price_date,
    'account_return_pct',(v_perf->>'return_pct')::numeric,
    'benchmark_return_krw_pct',v_return,
    'difference_pct',(v_perf->>'return_pct')::numeric-v_return,
    'benchmark_return_usd_pct',(v_end_close.close/v_start_close.close-1)*100,
    'fx_start',v_start_fx,'fx_end',v_end_fx,
    'fx_start_source',v_start_fx_source,'fx_end_source',v_end_fx_source);
end $$;
revoke all on function public.get_live_benchmark_comparison(text,text) from public,anon;
grant execute on function public.get_live_benchmark_comparison(text,text) to authenticated;
