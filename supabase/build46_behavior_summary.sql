-- Behavior facts that depend only on confirmed buy/sell ledger rows. Profitability
-- and closed-position outcomes require a complete lifecycle and are omitted.
create or replace function public.get_live_behavior_summary()
returns jsonb language sql stable security invoker set search_path='' as $fn$
with a as (
  select id from public.accounts where user_id=(select auth.uid())
    and mode='live' and is_active order by created_at limit 1
), trades as (
  select t.id,t.security_id,t.type,t.quantity,t.trade_at,
    case when t.type='buy' then t.quantity else -t.quantity end delta
  from public.transactions t where t.account_id=(select id from a)
    and t.type in ('buy','sell') and t.quantity>0 and t.security_id is not null
), positions as (
  select trades.*,
    sum(delta) over(partition by security_id order by trade_at,id rows unbounded preceding) quantity_after
  from trades
), events as (
  select positions.*,quantity_after-delta quantity_before,
    sum(case when type='sell' and quantity_after=0 then 1 else 0 end)
      over(partition by security_id order by trade_at,id rows between unbounded preceding and 1 preceding)
      previous_closes
  from positions
), eligible as (
  select e.security_id from events e group by e.security_id
  having min(least(e.quantity_before,e.quantity_after))>=0
    and not exists(select 1 from public.reconciliation_cases c
      where c.account_id=(select id from a) and c.security_id=e.security_id
        and c.status<>'resolved')
    and not exists(select 1 from public.transactions x
      where x.account_id=(select id from a) and x.security_id=e.security_id
        and x.type not in ('buy','sell','dividend')
        and coalesce(abs(x.quantity),0)>0)
), facts as (
  select count(*) filter(where type='buy') buy_events,
    count(*) filter(where type='sell') sell_events,
    count(distinct security_id) traded_symbols,
    count(*) filter(where type='buy' and quantity_before>0
      and security_id in (select security_id from eligible)) additional_buys,
    count(*) filter(where type='buy' and quantity_before=0 and previous_closes>0
      and security_id in (select security_id from eligible)) reentries,
    count(*) filter(where type='sell' and quantity_before>quantity and quantity_after>0
      and security_id in (select security_id from eligible)) partial_sells,
    count(*) filter(where type='sell' and quantity_before>0 and quantity_after=0
      and security_id in (select security_id from eligible)) full_sells,
    count(*) filter(where quantity_before<0 or quantity_after<0) invalid_lifecycle_events
  from events
)
select jsonb_build_object('ok',true,'basis','broker_buy_sell_ledger_only',
  'first_trade_date',(select min((trade_at at time zone 'Asia/Seoul')::date) from trades),
  'buy_events',buy_events,'sell_events',sell_events,'traded_symbols',traded_symbols,
  'lifecycle_eligible_symbols',(select count(*) from eligible),
  'additional_buys',additional_buys,'partial_sells',partial_sells,
  'full_sells',full_sells,'reentries',reentries,
  'invalid_lifecycle_events',invalid_lifecycle_events,
  'return_based_patterns_available',false) from facts;
$fn$;
revoke all on function public.get_live_behavior_summary() from public,anon;
grant execute on function public.get_live_behavior_summary() to authenticated;
