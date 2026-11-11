-- Historical price collection includes sold securities, with resumable
-- per-security progress. Broker charts may cap the available past window.
create table if not exists public.price_backfill_progress (
  account_id uuid not null references public.accounts(id),
  security_id uuid not null references public.securities(id),
  attempted_at timestamptz not null default now(),
  first_trade_date date,
  first_price_date date,
  last_price_date date,
  rows_read integer not null default 0,
  rows_written integer not null default 0,
  status text not null check(status in ('retrieved','unavailable','failed')),
  error_code text,
  primary key(account_id,security_id)
);
alter table public.price_backfill_progress enable row level security;
create policy "Owner reads price progress" on public.price_backfill_progress for select
to authenticated using (exists(
  select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())
));
revoke all on public.price_backfill_progress from public,anon,authenticated;
grant select on public.price_backfill_progress to authenticated;
grant all on public.price_backfill_progress to service_role;

create or replace function public.get_missing_price_history_for_service(
  p_user_id uuid,p_limit integer default 3)
returns table(security_id uuid,symbol text,market text,currency text,first_trade_date date)
language sql stable security definer set search_path='' as $fn$
with selected_account as (
  select a.id from public.accounts a where a.user_id=p_user_id and a.mode='live' and a.is_active
  order by a.created_at limit 1
), traded as (
  select t.security_id,min((t.trade_at at time zone 'Asia/Seoul')::date) first_trade
  from public.transactions t join selected_account a on a.id=t.account_id
  where t.type in ('buy','sell') and t.security_id is not null group by t.security_id
)
select s.id,s.symbol,s.market,s.currency,t.first_trade
from traded t join public.securities s on s.id=t.security_id
left join public.price_backfill_progress p
  on p.account_id=(select id from selected_account) and p.security_id=t.security_id
where p.attempted_at is null or p.attempted_at<now()-interval '21 days'
order by (p.attempted_at is not null),t.first_trade,s.symbol
limit greatest(1,least(coalesce(p_limit,3),5));
$fn$;
revoke all on function public.get_missing_price_history_for_service(uuid,integer)
from public,anon,authenticated;
grant execute on function public.get_missing_price_history_for_service(uuid,integer) to service_role;

create or replace function public.record_price_backfill_for_service(
 p_user_id uuid,p_security_id uuid,p_first_trade_date date,p_status text,
 p_rows_read integer,p_rows_written integer,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_account uuid;v_first date;v_last date;
begin
  if p_status not in ('retrieved','unavailable','failed') or p_rows_read<0 or p_rows_written<0 then
    raise exception 'invalid price collection status'; end if;
  select a.id into v_account from public.accounts a
  where a.user_id=p_user_id and a.mode='live' and a.is_active
  order by a.created_at limit 1;
  if v_account is null or not exists(
    select 1 from public.transactions t where t.account_id=v_account
    and t.security_id=p_security_id and t.type in ('buy','sell'))
    then raise exception 'unrecognized traded security';end if;
  select min(price_date),max(price_date) into v_first,v_last
  from public.daily_security_prices where security_id=p_security_id;
  insert into public.price_backfill_progress as progress
    (account_id,security_id,attempted_at,first_trade_date,first_price_date,
      last_price_date,rows_read,rows_written,status,error_code)
    values(v_account,p_security_id,now(),p_first_trade_date,v_first,v_last,
      p_rows_read,p_rows_written,p_status,left(p_error_code,120))
  on conflict (account_id,security_id) do update set
    attempted_at=excluded.attempted_at,first_trade_date=excluded.first_trade_date,
    first_price_date=excluded.first_price_date,last_price_date=excluded.last_price_date,
    rows_read=excluded.rows_read,rows_written=excluded.rows_written,
    status=excluded.status,error_code=excluded.error_code;
  return jsonb_build_object('ok',true,'first_price_date',v_first,'last_price_date',v_last,
    'full_lifecycle_covered',v_first is not null and v_first<=p_first_trade_date);
end $fn$;
revoke all on function public.record_price_backfill_for_service(uuid,uuid,date,text,integer,integer,text)
from public,anon,authenticated;
grant execute on function public.record_price_backfill_for_service(uuid,uuid,date,text,integer,integer,text)
to service_role;

create or replace function public.get_live_analysis_coverage()
returns jsonb language sql stable security invoker set search_path='' as $fn$
with a as (
  select id from public.accounts where user_id=(select auth.uid()) and mode='live' and is_active
  order by created_at limit 1
), t as (
  select distinct security_id from public.transactions where account_id=(select id from a)
    and security_id is not null and type in ('buy','sell')
), prices as (
  select count(*) priced_symbols,count(*) filter(where first_date <= first_trade) full_lifecycle_symbols
  from (
    select t.security_id,min(p.price_date) first_date,
      (select min(x.trade_at at time zone 'Asia/Seoul')::date from public.transactions x
       where x.account_id=(select id from a) and x.security_id=t.security_id and x.type in ('buy','sell')) first_trade
    from t left join public.daily_security_prices p on p.security_id=t.security_id
    group by t.security_id
  ) coverage where first_date is not null
)
select jsonb_build_object('ok',true,
  'traded_symbols',(select count(*) from t),
  'priced_symbols',(select priced_symbols from prices),
  'full_lifecycle_price_symbols',(select full_lifecycle_symbols from prices),
  'price_first_date',(select min(p.price_date) from public.daily_security_prices p join t on t.security_id=p.security_id),
  'cash_observation_days',(select count(distinct balance_date) from public.account_observations o where o.account_id=(select id from a)),
  'asset_snapshot_days',(select count(*) from public.daily_account_snapshots s where s.account_id=(select id from a)),
  'fx_confirmed_trades',(select count(*) from public.transactions x where x.account_id=(select id from a)
    and x.currency='USD' and x.type in ('buy','sell') and x.fx_rate between 500 and 3000),
  'fx_proxy_needed_trades',(select count(*) from public.transactions x where x.account_id=(select id from a)
    and x.currency='USD' and x.type in ('buy','sell') and (x.fx_rate is null or x.fx_rate not between 500 and 3000))
);
$fn$;
revoke all on function public.get_live_analysis_coverage() from public,anon;
grant execute on function public.get_live_analysis_coverage() to authenticated;
