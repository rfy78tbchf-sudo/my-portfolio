-- Local rollout candidate. Preserve existing column order/types for REST clients.
-- An unknown response is represented by null quantities, never legacy fallback.
create or replace view public.live_position_settlement_basis
with (security_invoker=true) as
with positions as (
 select h.account_id,s.symbol,s.currency,h.currency holding_currency,h.quantity,h.as_of,
   count(*) over(partition by h.account_id,s.symbol) identity_count,
   (select d.snapshot_at from public.daily_account_snapshots d where d.account_id=h.account_id
    order by d.snapshot_at desc limit 1) snapshot_at
 from public.holdings h join public.securities s on s.id=h.security_id
 join public.accounts a on a.id=h.account_id
 where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
), evidence as (
 select p.*,public.batch_balance_273(account_id::text,symbol,currency,as_of) b from positions p
), classified as (
 select e.*,case
 when identity_count<>1 or holding_currency is distinct from currency then 'identity_unverified'
 when as_of is distinct from snapshot_at then 'snapshot_mismatch'
 when b->>'status' is distinct from 'complete_row' then coalesce(b->>'status','missing')
 when quantity is distinct from (b->>'effective')::numeric then 'holding_mismatch'
 else 'complete_row' end status from evidence e
)
select account_id,symbol,
 (b->>'observed_at')::timestamptz observed_at,
 case when status='complete_row' then (b->>'settled')::numeric end settled_quantity,
 case when status='complete_row' then (b->>'pending_buy')::numeric end pending_buy_quantity,
 case when status='complete_row' then (b->>'pending_sell')::numeric end pending_sell_quantity,
 case when status='complete_row' then (b->>'effective')::numeric end effective_quantity,
 case when status='complete_row' then (b->>'settled')::numeric+(b->>'pending_buy')::numeric-(b->>'pending_sell')::numeric end reconstructed_effective_quantity,
 case when status='complete_row' then true end quantity_identity_ok,
 case when status='complete_row' then 'SSQM2952'::text end source,
 currency,status evidence_status,b->>'response_id' response_id
from classified;
revoke all on public.live_position_settlement_basis from public,anon;
grant select on public.live_position_settlement_basis to authenticated;
