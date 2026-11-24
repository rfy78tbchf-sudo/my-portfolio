-- Only create a service-only orchestration function; do not invoke collection.
do $guard$
begin
  if (select md5(prosrc) from pg_proc where oid='public.apply_kb_history_month_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure)
    <> '2dc9dbbe4d87ee6e85ba26eafbc60b3d' then
    raise exception 'HISTORY_WRITER_CHANGED_REVIEW_REQUIRED';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.link_kb_order_dates_for_service(uuid)'::regprocedure)
    <> '8ea9c2331fd2c0bc134fa4531cf9f7a2' then
    raise exception 'SETTLEMENT_LINKER_CHANGED_REVIEW_REQUIRED';
  end if;
end $guard$;

create or replace function public.apply_kb_history_bundle_for_service(
  p_user_id uuid,p_month text,p_transactions jsonb,p_dividends jsonb,
  p_cash_flows jsonb,p_realized jsonb,p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_applied jsonb; v_keys jsonb; v_batch jsonb; v_offset integer:=0;
  v_count integer; v_written integer:=0; v_retired integer; v_linked integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_user_id is null or p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or jsonb_typeof(p_transactions) is distinct from 'array'
    or jsonb_typeof(p_dividends) is distinct from 'array'
    or jsonb_typeof(p_cash_flows) is distinct from 'array'
    or jsonb_typeof(p_realized) is distinct from 'array'
    or jsonb_typeof(p_evidence) is distinct from 'array' then
    raise exception 'INVALID_HISTORY_BUNDLE';
  end if;
  v_count:=jsonb_array_length(p_evidence);
  if v_count>2000 or exists(select 1 from jsonb_array_elements(p_evidence) e
    where jsonb_typeof(e) is distinct from 'object'
      or e->>'source' is distinct from 'SPQM2205'
      or nullif(e->>'source_key','') is null or nullif(e->>'asset_key','') is null) then
    raise exception 'INVALID_MONTH_EVIDENCE';
  end if;
  -- The original writer creates the account if needed. Any subsequent failure
  -- rolls back its ledger writes and success log with the evidence changes.
  v_applied:=public.apply_kb_history_month_for_service(p_user_id,p_month,
    p_transactions,p_dividends,p_cash_flows,p_realized);
  while v_offset<v_count loop
    select jsonb_agg(value order by ordinality) into v_batch
      from jsonb_array_elements(p_evidence) with ordinality
      where ordinality>v_offset and ordinality<=v_offset+300;
    v_written:=v_written+public.save_kb_position_evidence_for_service(p_user_id,v_batch);
    v_offset:=v_offset+300;
  end loop;
  select coalesce(jsonb_agg(value->>'source_key'),'[]'::jsonb) into v_keys
    from jsonb_array_elements(p_evidence);
  perform public.reactivate_kb_evidence_for_service(p_user_id,v_keys);
  v_retired:=public.finish_kb_evidence_month_for_service(p_user_id,p_month,v_keys);
  -- Validate only after the incoming complete evidence set replaces active revisions.
  v_linked:=public.link_kb_order_dates_for_service(p_user_id);
  perform public.record_kb_evidence_month_for_service(p_user_id,p_month,v_count);
  return jsonb_build_object('applied',v_applied,'evidence_written',v_written,
    'retired_revisions',v_retired,'order_dates_linked',v_linked);
end $function$;
revoke all on function public.apply_kb_history_bundle_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_kb_history_bundle_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
