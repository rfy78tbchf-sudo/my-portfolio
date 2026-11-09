-- Build249: evaluate per-position evidence once, within the same RPC snapshot.
-- No persistent cache, data writes, account changes or calculation changes.
do $patch$
declare definition text;
 old_membership text := $old$(select count(*) from domestic_period_membership pm join dated_transactions dt on dt.id=pm.transaction_id join keys dk on dk.id=dt.security_id where dk.asset_key=calculated.asset_key and dt.effective_at is null)$old$;
 new_membership text := $new$case when p_period='ALL' then 0 else (select count(*) from domestic_period_membership pm join dated_transactions dt on dt.id=pm.transaction_id join keys dk on dk.id=dt.security_id where dk.asset_key=calculated.asset_key and dt.effective_at is null) end$new$;
begin
 select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into definition;
 if position('), evidence as materialized (' in definition)>0 and position(new_membership in definition)>0 then return; end if;
 if md5(btrim(definition,E' \n\r\t'))<>'2b7c43eedb58737d5203f92504daf6e5' then
  raise exception 'Build249 period function drift: inspect current definition before applying';
 end if;
 if (length(definition)-length(replace(definition,'), evidence as (','')))/length('), evidence as (')<>1 then
  raise exception 'Build249 expected one evidence CTE';
 end if;
 if (length(definition)-length(replace(definition,old_membership,'')))/length(old_membership)<>1 then
  raise exception 'Build249 expected one membership count';
 end if;
 -- ALL has no bounded-period membership candidates by definition. This is a
 -- diagnostic count only; no missing P&L or financial amount is set to zero.
 execute replace(replace(definition,'), evidence as (','), evidence as materialized ('),old_membership,new_membership);
end $patch$;
