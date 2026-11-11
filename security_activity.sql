-- Exact, user-owned transaction and paid dividend history for a security.
-- Amounts are displayed in source currency; a sale is never labelled profit
-- unless an official amount exists on the transaction itself.
create or replace function public.get_live_security_activity(
  p_security_id uuid, p_limit integer default 30
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_items jsonb;
  v_limit integer := greatest(1,least(coalesce(p_limit,30),100));
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_security_id is null then raise exception 'security required'; end if;
  with events as (
    select t.trade_at as occurred_at,t.type as kind,t.quantity,t.price,
      t.net_amount as amount,t.currency,t.official_realized_pnl as official_pnl,
      a.name as account_name,t.id::text as event_id
    from public.transactions t
    join public.accounts a on a.id=t.account_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and t.security_id=p_security_id and t.type in ('buy','sell')
    union all
    select d.paid_at,'dividend'::text,null::numeric,null::numeric,
      d.net_amount,d.currency,null::numeric,a.name,d.id::text
    from public.dividends d
    join public.accounts a on a.id=d.account_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and d.security_id=p_security_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'occurred_at',q.occurred_at,'kind',q.kind,'quantity',q.quantity,
    'price',q.price,'amount',q.amount,'currency',q.currency,
    'official_pnl',q.official_pnl,'account_name',q.account_name
  ) order by q.occurred_at desc,q.event_id desc),'[]'::jsonb)
  into v_items
  from (select * from events order by occurred_at desc,event_id desc limit v_limit) q;
  return jsonb_build_object('ok',true,'items',v_items);
end;
$$;
revoke all on function public.get_live_security_activity(uuid,integer) from public,anon;
grant execute on function public.get_live_security_activity(uuid,integer) to authenticated;
