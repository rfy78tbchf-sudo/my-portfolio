-- Run in an owner-authenticated transaction after installing Build115.
-- Read-only consistency assertions over the current calculation output.
do $$
declare r jsonb;i jsonb;p text;v_sum numeric;
begin
 foreach p in array array['오늘','THIS_MONTH'] loop
  r:=public.get_live_period_stock_pnl(p);
  if not coalesce((r->>'ok')::boolean,false) then raise exception 'Owner account unavailable';end if;
  select sum((x->>'pnl_krw')::numeric) into v_sum from jsonb_array_elements(r->'items') x;
  if abs(coalesce(v_sum,0)-coalesce((r->>'pnl_krw')::numeric,0))>.01 then raise exception 'Item total mismatch';end if;
  if abs(coalesce((r->'calculation'->>'difference_krw')::numeric,0))>.01 then raise exception 'Cashflow identity mismatch';end if;
  for i in select value from jsonb_array_elements(r->'items') loop
   if i->>'reason' is not null and (i->>'pnl_krw' is not null or i->>'pnl_local' is not null) then raise exception 'Unresolved item counted';end if;
   if p='오늘' and (i->>'start_quantity')::numeric>0 and i->>'reason' is null and i->>'opening_basis'<>'account_snapshot' then raise exception 'Today uses a historical close';end if;
  end loop;
 end loop;
end $$;
