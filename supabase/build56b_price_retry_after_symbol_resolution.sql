-- A failed historical chart lookup is eligible for one immediate retry after
-- an independently evidenced canonical ticker correction. Its old attempt is
-- retained. A subsequent attempt returns to the normal 21-day cooldown.
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
left join public.security_symbol_resolutions r
  on r.account_id=(select id from selected_account) and r.original_security_id=s.id
where p.attempted_at is null or p.attempted_at<now()-interval '21 days'
  or (p.status='unavailable' and r.state='confirmed_canonical'
      and r.proof_reference is not null and p.attempted_at<r.checked_at)
order by (p.attempted_at is not null),t.first_trade,s.symbol
limit greatest(1,least(coalesce(p_limit,3),150));
$fn$;
revoke all on function public.get_missing_price_history_for_service(uuid,integer)
from public,anon,authenticated;
grant execute on function public.get_missing_price_history_for_service(uuid,integer) to service_role;
