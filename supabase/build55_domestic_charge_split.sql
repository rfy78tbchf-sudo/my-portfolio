-- Correct only derived domestic brokerage tax where independent gross/cash
-- fields prove that SWQA2301 `tx` already includes the brokerage fee.
-- The original provider payload, IDs, quantities, cash, and audit trail remain.
with eligible as (
  select t.id,t.fee,t.tax,
    replace(trim(t.provider_payload->>'dl_amt'),',','') as raw_gross,
    trim(t.provider_payload->>'tx') as raw_charge
  from public.transactions t
  where t.source='api' and t.type in ('buy','sell') and t.currency='KRW'
    and t.fee>0 and t.provider_payload->>'tx' ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
    and replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+(\.[0-9]+)?$'
), reconciled as (
  select e.id,e.tax-e.fee as corrected_tax from eligible e
  join public.transactions t on t.id=e.id
  where e.tax=e.raw_charge::numeric and e.tax>=e.fee
    and abs((case when t.type='buy' then abs(t.net_amount)-e.raw_gross::numeric
      else e.raw_gross::numeric-abs(t.net_amount) end)-e.raw_charge::numeric)<=0.02
)
update public.transactions t set tax=r.corrected_tax
from reconciled r where t.id=r.id and t.tax is distinct from r.corrected_tax;
