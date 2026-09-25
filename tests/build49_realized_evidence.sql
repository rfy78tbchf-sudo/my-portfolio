-- Read-only production check. Run under an authenticated account owner.
with report as (select public.get_live_ledger_realized('1W') j),
  items as (select x from report, jsonb_array_elements(j->'items') x)
select x->>'symbol' symbol,x->>'status' status,x->>'currency' currency,
  x->>'allocated_cost' allocated_cost,x->>'net_proceeds' net_proceeds,
  x->>'realized_local' realized_local,x->>'missing_code' missing_code
from items where x->>'symbol' in ('NVO','SOXX','SOXL') order by symbol;
