-- The integrated KB balance exposes settled holdings (hld_q), effective
-- holdings (ec_q), and each unsettled buy/sell leg. Save only these fields.
create table if not exists public.kb_balance_position_evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  symbol text not null,
  observed_at timestamptz not null default now(),
  settled_quantity numeric not null,
  effective_quantity numeric not null,
  pending_buy_quantity numeric not null default 0,
  pending_sell_quantity numeric not null default 0,
  source text not null default 'SSQM2952',
  unique(account_id,symbol,observed_at)
);
create index if not exists kb_balance_position_evidence_lookup
  on public.kb_balance_position_evidence(account_id,symbol,observed_at desc);
alter table public.kb_balance_position_evidence enable row level security;
create policy kb_balance_position_evidence_read on public.kb_balance_position_evidence
  for select to authenticated using(exists(select 1 from public.accounts a
    where a.id=account_id and a.user_id=(select auth.uid())));
grant select on public.kb_balance_position_evidence to authenticated;

alter table public.reconciliation_cases drop constraint reconciliation_case_status_check;
alter table public.reconciliation_cases add constraint reconciliation_case_status_check check(status in
  ('resolved','settlement_pending','likely_missing_trade','likely_transfer','likely_corporate_action',
    'source_data_insufficient','manual_source_required',
    'position_closed_but_trade_details_missing','user_confirmed_position_closed'));

create or replace function public.save_kb_balance_position_evidence_for_service(p_user_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_account uuid;v_row jsonb;v_count int:=0;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>100 then raise exception 'INVALID_BALANCE_ROWS'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  if v_account is null then raise exception 'NO_LIVE_ACCOUNT'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if nullif(v_row->>'symbol','') is null then continue; end if;
    insert into public.kb_balance_position_evidence(account_id,symbol,settled_quantity,
      effective_quantity,pending_buy_quantity,pending_sell_quantity)
    values(v_account,v_row->>'symbol',coalesce((v_row->>'settled_quantity')::numeric,0),
      coalesce((v_row->>'effective_quantity')::numeric,0),
      coalesce((v_row->>'pending_buy_quantity')::numeric,0),
      coalesce((v_row->>'pending_sell_quantity')::numeric,0));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;
revoke all on function public.save_kb_balance_position_evidence_for_service(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_balance_position_evidence_for_service(uuid,jsonb) to service_role;
