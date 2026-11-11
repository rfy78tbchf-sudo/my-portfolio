-- Broker chart endpoints accept an as-of date. Advance an independent,
-- resumable per-security cursor instead of repeating the latest 300 bars.
create table if not exists public.price_window_progress (
  account_id uuid not null references public.accounts(id),
  security_id uuid not null references public.securities(id),
  last_cursor date not null,
  oldest_price_date date,
  last_attempt_at timestamptz not null default now(),
  rows_read integer not null default 0,
  rows_written integer not null default 0,
  status text not null check(status in ('retrieved','complete','blocked','failed')),
  error_code text,
  primary key(account_id,security_id)
);
alter table public.price_window_progress enable row level security;
create policy "Owner reads historical price progress" on public.price_window_progress
  for select to authenticated using(exists(
    select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())
  ));
revoke all on public.price_window_progress from public,anon,authenticated;
grant select on public.price_window_progress to authenticated;
grant all on public.price_window_progress to service_role;

create or replace function public.get_next_price_windows_for_service(
 p_user_id uuid,p_limit integer default 3)
returns table(security_id uuid,symbol text,market text,currency text,
 first_trade_date date,cursor_date date)
language sql stable security definer set search_path='' as $fn$
with a as (select id from public.accounts where user_id=p_user_id and mode='live'
    and is_active order by created_at limit 1),
 traded as (select t.security_id,min((t.trade_at at time zone 'Asia/Seoul')::date) first_trade
    from public.transactions t join a on a.id=t.account_id
    where t.security_id is not null and t.type in ('buy','sell')
    group by t.security_id),
 candidates as (select t.security_id,t.first_trade,s.symbol,s.market,s.currency,
   (select min(x.price_date) from public.daily_security_prices x where x.security_id=t.security_id) oldest,
   (select exists(select 1 from public.holdings h where h.account_id=(select id from a)
     and h.security_id=t.security_id and h.quantity>0)) currently_held,
   p.status,p.last_attempt_at
   from traded t join public.securities s on s.id=t.security_id
   left join public.price_window_progress p on p.account_id=(select id from a)
    and p.security_id=t.security_id)
select security_id,symbol,market,currency,first_trade,
  (oldest-1)::date as cursor_date
from candidates where oldest is not null and oldest>first_trade
  and (status is null or status='retrieved' or
    (status='failed' and last_attempt_at<now()-interval '6 hours'))
order by currently_held desc,first_trade,oldest,symbol
limit greatest(1,least(coalesce(p_limit,3),150));
$fn$;
revoke all on function public.get_next_price_windows_for_service(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.get_next_price_windows_for_service(uuid,integer)
  to service_role;

create or replace function public.record_price_window_for_service(
  p_user_id uuid,p_security_id uuid,p_cursor date,p_status text,
  p_rows_read integer,p_rows_written integer,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_account uuid;v_first date;v_trade date;
begin
  if p_status not in ('retrieved','complete','blocked','failed')
    or p_rows_read<0 or p_rows_written<0 or p_cursor is null then
    raise exception 'invalid historical price progress'; end if;
  select id into v_account from public.accounts where user_id=p_user_id
    and mode='live' and is_active order by created_at limit 1;
  select min((trade_at at time zone 'Asia/Seoul')::date) into v_trade
  from public.transactions where account_id=v_account and security_id=p_security_id
    and type in ('buy','sell');
  if v_account is null or v_trade is null then raise exception 'unrecognized security';end if;
  select min(price_date) into v_first from public.daily_security_prices
    where security_id=p_security_id;
  insert into public.price_window_progress as progress
    (account_id,security_id,last_cursor,oldest_price_date,last_attempt_at,
     rows_read,rows_written,status,error_code)
    values(v_account,p_security_id,p_cursor,v_first,now(),p_rows_read,
      p_rows_written,case when v_first<=v_trade then 'complete' else p_status end,
      left(p_error_code,100))
  on conflict(account_id,security_id) do update set
    last_cursor=excluded.last_cursor,oldest_price_date=excluded.oldest_price_date,
    last_attempt_at=excluded.last_attempt_at,rows_read=excluded.rows_read,
    rows_written=excluded.rows_written,status=excluded.status,error_code=excluded.error_code;
  return jsonb_build_object('ok',true,'oldest_price_date',v_first,
    'first_trade_date',v_trade,'full_lifecycle_covered',v_first<=v_trade);
end $fn$;
revoke all on function public.record_price_window_for_service(uuid,uuid,date,text,integer,integer,text)
  from public,anon,authenticated;
grant execute on function public.record_price_window_for_service(uuid,uuid,date,text,integer,integer,text)
  to service_role;

select cron.schedule('kb-cursor-price-history','15 * * * *',$job$
  select net.http_post(
    url:='https://buimrsjowlmfkxxaithj.supabase.co/functions/v1/kb-sync-worker',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-internal-sync-key',public.get_kb_internal_sync_key_for_service()),
    body:='{"action":"sync-history-price-windows","securities":3}'::jsonb,
    timeout_milliseconds:=120000)
  where exists (select 1 from public.accounts where mode='live' and is_active);
$job$);
