-- Definition-only change. Never invoke collection or rewrite stored rows here.
do $migration$
declare
  v_oid regprocedure := 'public.apply_kb_history_month_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure;
  v_definition text;
  v_body text;
  v_anchor text := '  insert into public.sync_logs(';
begin
  select prosrc,pg_get_functiondef(oid) into v_body,v_definition
  from pg_proc where oid=v_oid;
  if md5(v_body) <> '2dc9dbbe4d87ee6e85ba26eafbc60b3d' then
    raise exception 'HISTORY_WRITER_CHANGED_REVIEW_REQUIRED';
  end if;
  if (length(v_body)-length(replace(v_body,v_anchor,'')))/length(v_anchor) <> 1 then
    raise exception 'HISTORY_WRITER_ANCHOR_NOT_UNIQUE';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.link_kb_order_dates_for_service(uuid)'::regprocedure)
     <> '8ea9c2331fd2c0bc134fa4531cf9f7a2' then
    raise exception 'SETTLEMENT_LINKER_CHANGED_REVIEW_REQUIRED';
  end if;
  -- Use precisely the existing matching rules. A failure aborts this write,
  -- rather than committing a cleared date before a separate repair RPC.
  v_definition := replace(v_definition,v_anchor,
    E'  perform public.link_kb_order_dates_for_service(p_user_id);\n\n' || v_anchor);
  execute v_definition;
end
$migration$;
