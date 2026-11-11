-- Exact calendar-year and month-to-date paid dividends. Future deposits are
-- shown only if the provider has supplied an actual future payment date.
create or replace function public.get_live_dividend_overview()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_year numeric;
  v_month numeric;
  v_count integer;
  v_recent jsonb;
  v_upcoming jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  with owned as (
    select d.*,s.name,s.symbol from public.dividends d
    join public.accounts a on a.id=d.account_id
    left join public.securities s on s.id=d.security_id
    where a.user_id=v_user and a.mode='live' and a.is_active
  )
  select coalesce(sum(net_amount*coalesce(fx_rate_to_base,1)) filter(
      where (paid_at at time zone 'Asia/Seoul')::date>=date_trunc('year',v_today)::date
        and (paid_at at time zone 'Asia/Seoul')::date<=v_today),0),
    coalesce(sum(net_amount*coalesce(fx_rate_to_base,1)) filter(
      where (paid_at at time zone 'Asia/Seoul')::date>=date_trunc('month',v_today)::date
        and (paid_at at time zone 'Asia/Seoul')::date<=v_today),0),
    count(*) filter(where (paid_at at time zone 'Asia/Seoul')::date>=date_trunc('year',v_today)::date
      and (paid_at at time zone 'Asia/Seoul')::date<=v_today)
  into v_year,v_month,v_count from owned;
  select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'symbol',q.symbol,
    'paid_at',q.paid_at,'net_krw',q.net_amount*coalesce(q.fx_rate_to_base,1))
    order by q.paid_at desc),'[]'::jsonb) into v_recent
  from (select d.*,s.name,s.symbol from public.dividends d
    join public.accounts a on a.id=d.account_id
    left join public.securities s on s.id=d.security_id
    where a.user_id=v_user and a.mode='live' and a.is_active and d.paid_at<=now()
    order by d.paid_at desc limit 5) q;
  select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'symbol',q.symbol,
    'paid_at',q.paid_at) order by q.paid_at),'[]'::jsonb) into v_upcoming
  from (select d.paid_at,s.name,s.symbol from public.dividends d
    join public.accounts a on a.id=d.account_id
    left join public.securities s on s.id=d.security_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and (d.paid_at at time zone 'Asia/Seoul')::date>v_today
    order by d.paid_at limit 5) q;
  return jsonb_build_object('ok',true,'year_paid_krw',v_year,
    'month_paid_krw',v_month,'year_payment_count',v_count,
    'recent',v_recent,'upcoming_confirmed',v_upcoming,'as_of',v_today);
end;
$$;
revoke all on function public.get_live_dividend_overview() from public,anon;
grant execute on function public.get_live_dividend_overview() to authenticated;
