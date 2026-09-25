-- Use KB's latest effective position for investment exposure and keep the
-- settled/pending legs separate. Settlement does not create a second trade.
create or replace view public.live_position_settlement_basis
with (security_invoker=true) as
select distinct on (e.account_id,e.symbol)
  e.account_id,e.symbol,e.observed_at,e.settled_quantity,
  e.pending_buy_quantity,e.pending_sell_quantity,e.effective_quantity,
  e.settled_quantity+e.pending_buy_quantity-e.pending_sell_quantity
    as reconstructed_effective_quantity,
  abs(e.effective_quantity-(e.settled_quantity+e.pending_buy_quantity-e.pending_sell_quantity))<0.000001
    as quantity_identity_ok,
  e.source
from public.kb_balance_position_evidence e
order by e.account_id,e.symbol,e.observed_at desc;
revoke all on public.live_position_settlement_basis from public,anon;
grant select on public.live_position_settlement_basis to authenticated;
