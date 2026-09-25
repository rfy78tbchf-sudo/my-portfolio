-- Source corrections remain auditable, while only the latest complete monthly
-- query participates in quantity inference.
alter table public.kb_position_evidence add column if not exists active boolean not null default true;

create or replace function public.finish_kb_evidence_month_for_service(
  p_user_id uuid,p_month text,p_source_keys jsonb)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_account uuid;v_count int;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_month !~ '^\d{4}-\d{2}$' or jsonb_typeof(p_source_keys)<>'array'
    or jsonb_array_length(p_source_keys)>2000 then raise exception 'INVALID_MONTH_EVIDENCE'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  update public.kb_position_evidence e set active=false
    where e.account_id=v_account and e.source='SPQM2205'
      and e.order_date >=(p_month||'-01')::date
      and e.order_date <((p_month||'-01')::date + interval '1 month')
      and e.active and not exists(select 1 from jsonb_array_elements_text(p_source_keys) x
        where x.value=e.source_key);
  get diagnostics v_count=row_count;
  return v_count;
end $function$;
revoke all on function public.finish_kb_evidence_month_for_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_kb_evidence_month_for_service(uuid,text,jsonb) to service_role;

create or replace function public.reactivate_kb_evidence_for_service(p_user_id uuid,p_source_keys jsonb)
returns void language plpgsql security definer set search_path='' as $function$
declare v_account uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  update public.kb_position_evidence e set active=true,fetched_at=now()
  where e.account_id=v_account and e.source_key in
    (select value from jsonb_array_elements_text(p_source_keys));
end $function$;
revoke all on function public.reactivate_kb_evidence_for_service(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reactivate_kb_evidence_for_service(uuid,jsonb) to service_role;

-- Replacing the case timeline after adding `active` can reset its SECURITY flag.
alter function public.get_reconciliation_case_timeline(uuid) security invoker;
