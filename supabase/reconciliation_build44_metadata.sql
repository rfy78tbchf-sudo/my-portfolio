create or replace function public.audit_kb_transaction_type() returns trigger
language plpgsql set search_path='' as $function$
declare v_summary text;v_date text;
begin
  if new.source<>'api' then return new; end if;
  v_summary:=coalesce(new.provider_payload->>'smry_nm','');
  new.raw_type:=coalesce(nullif(new.raw_type,''),v_summary);
  new.normalized_type:=case
    when new.type='transfer_in' and v_summary~'타사|타계좌' then 'BROKER_TRANSFER_IN'
    when new.type='transfer_out' and v_summary~'타사|타계좌' then 'BROKER_TRANSFER_OUT'
    when new.type in ('transfer_in','transfer_out') and v_summary~'대체|계좌' then 'ACCOUNT_TRANSFER'
    when new.type='transfer_in' then 'TRANSFER_IN'
    when new.type='transfer_out' then 'TRANSFER_OUT'
    when new.type in ('split_in','split_out') and v_summary~'병합' then 'REVERSE_SPLIT'
    when new.type in ('split_in','split_out') then 'STOCK_SPLIT'
    when new.type in ('corporate_in','corporate_out') and v_summary~'종목변경' then 'SYMBOL_CHANGE'
    when new.type in ('corporate_in','corporate_out') and v_summary~'스핀오프' then 'SPINOFF'
    when new.type in ('corporate_in','corporate_out') and v_summary~'합병' then 'MERGER'
    when new.type in ('corporate_in','corporate_out') and v_summary~'주식배당|무상증자' then 'STOCK_DIVIDEND'
    when new.type in ('corporate_in','corporate_out') and v_summary~'권리|유상증자' then 'RIGHTS_EVENT'
    else upper(new.type) end;
  new.fetched_at:=now();
  v_date:=coalesce(new.provider_payload->>'ordr_dt','');
  if v_date ~ '^\d{8}$' then new.order_at:=to_date(v_date,'YYYYMMDD')::timestamp at time zone 'Asia/Seoul'; end if;
  v_date:=coalesce(new.provider_payload->>'stmt_dt','');
  if v_date ~ '^\d{8}$' then new.settlement_at:=to_date(v_date,'YYYYMMDD')::timestamp at time zone 'Asia/Seoul'; end if;
  return new;
end $function$;
drop trigger if exists audit_kb_transaction_type on public.transactions;
create trigger audit_kb_transaction_type before insert or update on public.transactions
  for each row execute function public.audit_kb_transaction_type();

alter table public.kb_backfill_months add column if not exists evidence_rows int,
  add column if not exists evidence_checked_at timestamptz;

create or replace function public.record_kb_evidence_month_for_service(p_user_id uuid,p_month text,p_count integer)
returns void language plpgsql security definer set search_path='' as $function$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update public.kb_backfill_months set evidence_rows=p_count,evidence_checked_at=now()
    where user_id=p_user_id and month=(p_month||'-01')::date;
end $function$;
revoke all on function public.record_kb_evidence_month_for_service(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.record_kb_evidence_month_for_service(uuid,text,integer) to service_role;

-- Link two official records of the same executed position change. Order and
-- settlement dates remain separate; ambiguous duplicate signatures are skipped.
create or replace function public.link_kb_order_dates_for_service(p_user_id uuid)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_account uuid;v_count integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  with unique_pairs as (
    select t.id transaction_id,min(e.order_date) order_date,min(e.settlement_date) settlement_date
    from public.transactions t join public.kb_position_evidence e
      on e.account_id=t.account_id
      and e.asset_key=t.provider_payload->>'stnd_is_cd'
      and e.settlement_date=(t.trade_at at time zone 'Asia/Seoul')::date
      and e.event_type=t.type and e.quantity=t.quantity
    where t.account_id=v_account and t.source='api' and t.provider_revision='SWQA2301'
    group by t.id having count(*)=1
  ) update public.transactions t
    set order_at=p.order_date::timestamp at time zone 'Asia/Seoul',
      settlement_at=p.settlement_date::timestamp at time zone 'Asia/Seoul'
    from unique_pairs p where t.id=p.transaction_id
      and (t.order_at is distinct from (p.order_date::timestamp at time zone 'Asia/Seoul')
        or t.settlement_at is distinct from (p.settlement_date::timestamp at time zone 'Asia/Seoul'));
  get diagnostics v_count=row_count;
  return v_count;
end $function$;
revoke all on function public.link_kb_order_dates_for_service(uuid) from public,anon,authenticated;
grant execute on function public.link_kb_order_dates_for_service(uuid) to service_role;

create or replace function public.save_kb_cash_observation_for_service(
  p_user_id uuid,p_domestic_cash_krw numeric,p_foreign_cash_krw_equivalent numeric)
returns void language plpgsql security definer set search_path='' as $function$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update public.account_observations o set cash_krw=p_domestic_cash_krw,
    foreign_cash=jsonb_build_object('KRW_equivalent',p_foreign_cash_krw_equivalent,
      'original_currency_amounts','not_provided_by_integrated_balance')
  where o.id=(select x.id from public.account_observations x join public.accounts a on a.id=x.account_id
    where a.user_id=p_user_id and a.mode='live' and a.provider='kb_securities'
    order by x.fetched_at desc limit 1);
end $function$;
revoke all on function public.save_kb_cash_observation_for_service(uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.save_kb_cash_observation_for_service(uuid,numeric,numeric) to service_role;

create or replace function public.next_kb_evidence_month_for_service(p_user_id uuid)
returns text language plpgsql security definer set search_path='' as $function$
declare v_month text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select to_char(b.month,'YYYY-MM') into v_month from public.kb_backfill_months b
    where b.user_id=p_user_id and b.evidence_checked_at is null
    order by b.month desc limit 1;
  return v_month;
end $function$;
revoke all on function public.next_kb_evidence_month_for_service(uuid) from public,anon,authenticated;
grant execute on function public.next_kb_evidence_month_for_service(uuid) to service_role;
