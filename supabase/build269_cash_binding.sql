create or replace function public.save_kb_cash_for_response_for_service(
  p_user_id uuid,p_source_requested_at timestamptz,p_domestic_cash_krw numeric,p_foreign_cash_krw_equivalent numeric)
returns void language plpgsql security definer set search_path='' as $function$
declare v_ids uuid[];
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_source_requested_at is null or p_domestic_cash_krw is null or p_foreign_cash_krw_equivalent is null or p_domestic_cash_krw::text in ('NaN','Infinity','-Infinity') or p_foreign_cash_krw_equivalent::text in ('NaN','Infinity','-Infinity') then raise exception 'INCOMPLETE_CASH_RESPONSE'; end if;
  select array_agg(distinct o.id) into v_ids
  from public.account_observations o join public.accounts a on a.id=o.account_id
  join public.sync_logs l on l.account_id=a.id and l.started_at=o.fetched_at
  where a.user_id=p_user_id and a.mode='live' and a.provider='kb_securities'
  and l.scope='kb_current_snapshot' and l.status='success'
  and (l.detail->>'source_requested_at')::timestamptz=p_source_requested_at;
  if coalesce(cardinality(v_ids),0)<>1 then raise exception 'CASH_RESPONSE_BINDING_UNAVAILABLE'; end if;
  update public.account_observations set cash_krw=p_domestic_cash_krw,
    foreign_cash=jsonb_build_object('KRW_equivalent',p_foreign_cash_krw_equivalent,
    'original_currency_amounts','not_provided_by_integrated_balance') where id=v_ids[1];
end $function$;
revoke all on function public.save_kb_cash_for_response_for_service(uuid,timestamptz,numeric,numeric) from public,anon,authenticated;
grant execute on function public.save_kb_cash_for_response_for_service(uuid,timestamptz,numeric,numeric) to service_role;

