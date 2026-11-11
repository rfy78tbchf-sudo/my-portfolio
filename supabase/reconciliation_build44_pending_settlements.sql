-- Pending official execution rows affect lifecycle confidence even if same-day
-- buys and sells cancel to a zero net quantity change.
create or replace function public.get_pending_kb_position_events()
returns jsonb language sql stable security invoker set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('symbol',x.symbol,
    'order_date',x.order_date,'settlement_date',x.settlement_date,
    'type',x.event_type,'quantity',x.quantity) order by x.order_date desc),'[]'::jsonb)
  from (
    select e.symbol,e.order_date,e.settlement_date,e.event_type,e.quantity
    from public.kb_position_evidence e join public.accounts a on a.id=e.account_id
    where a.user_id=(select auth.uid()) and a.mode='live' and e.active
      and e.order_date>=((now() at time zone 'Asia/Seoul')::date - 90)
      and not exists(select 1 from public.transactions t
        where t.account_id=e.account_id and t.provider_payload->>'stnd_is_cd'=e.asset_key
          and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
          and t.type=e.event_type and t.quantity=e.quantity)
    order by e.order_date desc limit 100
  ) x;
$function$;
revoke all on function public.get_pending_kb_position_events() from public,anon;
grant execute on function public.get_pending_kb_position_events() to authenticated;
