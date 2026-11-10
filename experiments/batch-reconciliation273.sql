-- Local-only. Invoker access uses the existing prototype owner RLS.
create function public.batch_balance_273(a text,s text,c text,t timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
with batch as(select public.read_batch_at_273(a,t) j), picked as (
 select j,r from batch left join lateral (
 select value r from jsonb_array_elements(coalesce(j->'rows','[]'::jsonb)) where value->>'symbol'=s and value->>'currency'=c
 ) x on true
), classified as (
 select j,r,case when j is null then 'missing'
 when (j->>'observed_at')::timestamptz is distinct from t then 'cutoff_mismatch'
 when (j->>'complete')::boolean is not true then 'incomplete'
 when r is null then 'complete_absent'
 when r->>'source' is distinct from 'SSQM2952' or
 (r->>'effective_quantity')::numeric is null or (r->>'settled_quantity')::numeric is null or
 (r->>'pending_buy_quantity')::numeric is null or (r->>'pending_sell_quantity')::numeric is null or
 (r->>'effective_quantity')::numeric is distinct from (r->>'settled_quantity')::numeric+(r->>'pending_buy_quantity')::numeric-(r->>'pending_sell_quantity')::numeric
 then 'quantity_unknown' else 'complete_row' end status from picked
)
select jsonb_build_object('status',status,'response_id',j->'response_id','observed_at',j->'observed_at',
 'symbol',case when status='complete_row' then s end,
 'settled',case when status='complete_row' then r->'settled_quantity' end,
 'effective',case when status='complete_row' then r->'effective_quantity' end,
 'pending_buy',case when status='complete_row' then r->'pending_buy_quantity' end,
 'pending_sell',case when status='complete_row' then r->'pending_sell_quantity' end)
 from classified
$$;
revoke all on function public.batch_balance_273(text,text,text,timestamptz) from public,anon;
grant execute on function public.batch_balance_273(text,text,text,timestamptz) to authenticated,service_role;
