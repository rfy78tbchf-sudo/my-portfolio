-- A screenshot supplies an account total but no component values or broker
-- valuation timestamp. Keep it apart from the older manual composition and
-- from the broker API daily NAV used for historical performance.
create table if not exists public.account_total_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  scope_evidence_id uuid not null unique references public.kb_account_scope_evidence(id),
  total_assets numeric not null check (total_assets >= 0),
  captured_at timestamptz not null,
  balance_effective_at timestamptz,
  source_reference text not null,
  verification_level text not null check (verification_level in ('broker_screen_amount_identifier_unverified','broker_account_identifier_matched')),
  component_state text not null default 'account_total_only' check (component_state='account_total_only'),
  recorded_at timestamptz not null default now(),
  unique(account_id,source_reference)
);
alter table public.account_total_observations enable row level security;
create policy account_total_observations_owner_read on public.account_total_observations
  for select to authenticated using (exists (
    select 1 from public.accounts a
    where a.id=account_id and a.user_id=(select auth.uid())
  ));
revoke all on public.account_total_observations from public,anon;
grant select on public.account_total_observations to authenticated;

-- Reuse the already verified, idempotent screenshot evidence. Do not create
-- transactions, flows, portfolio holdings, cash, or a backdated daily NAV.
insert into public.account_total_observations (
  account_id,scope_evidence_id,total_assets,captured_at,
  balance_effective_at,source_reference,verification_level
)
select e.manual_account_id,e.id,e.broker_isa_total,e.broker_capture_at,
  null,e.source_reference,'broker_screen_amount_identifier_unverified'
from public.kb_account_scope_evidence e
join public.accounts a on a.id=e.account_id and a.user_id=(
  select ma.user_id from public.accounts ma where ma.id=e.manual_account_id)
where e.source_reference='owner_kb_account_breakdown_IMG_9346'
  and e.broker_primary_total+e.broker_isa_total=e.broker_aggregate_total
on conflict (account_id,source_reference) do nothing;

-- One canonical live asset scope for the home, risk, scenarios and AI. The
-- snapshot fields remain frozen historical observations; current_* denotes
-- latest available account-level observations, possibly with different cuts.
create or replace function public.get_live_current_account_scope()
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_base jsonb := public.get_live_account_scope();
  v_old_isa numeric;
  v_isa numeric;
  v_isa_at timestamptz;
  v_isa_id uuid;
  v_isa_balance_at timestamptz;
  v_primary numeric;
  v_primary_at timestamptz;
  v_primary_source text := 'kb_api_response';
  v_isa_source text := 'manual_snapshot';
  v_observation record;
  v_evidence public.kb_account_scope_evidence%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_base is null or (v_base->>'ok')::boolean is distinct from true then return v_base; end if;
  v_primary:=(v_base->>'kb_response_total')::numeric;
  v_primary_at:=(v_base->>'snapshot_at')::timestamptz;
  v_old_isa:=(v_base->>'manual_current_total')::numeric;
  v_isa:=v_old_isa;
  v_isa_at:=(v_base->>'manual_observed_at')::timestamptz;
  select o.id,o.total_assets,o.captured_at,o.balance_effective_at,o.scope_evidence_id
    into v_observation
  from public.account_total_observations o
  join public.accounts a on a.id=o.account_id
  where a.user_id=(select auth.uid()) and a.provider='kb_securities_manual'
    and a.mode='live' and a.is_active and o.captured_at>v_isa_at
  order by o.captured_at desc,o.recorded_at desc limit 1;
  if v_observation.id is not null then
    v_isa_id:=v_observation.id;
    v_isa:=v_observation.total_assets;
    v_isa_at:=v_observation.captured_at;
    v_isa_balance_at:=v_observation.balance_effective_at;
    v_isa_source:='kb_account_breakdown_screenshot';
    select e.* into v_evidence from public.kb_account_scope_evidence e
      join public.accounts a on a.id=e.account_id
      where e.id=v_observation.scope_evidence_id and a.user_id=(select auth.uid());
    if v_evidence.id is not null and v_evidence.broker_capture_at>=v_primary_at then
      v_primary:=v_evidence.broker_primary_total;
      v_primary_at:=v_evidence.broker_capture_at;
      v_primary_source:='kb_account_breakdown_screenshot';
    end if;
  end if;
  return v_base || jsonb_build_object(
    'current_display_total',case when v_primary is not null and v_isa is not null then v_primary+v_isa else null end,
    'current_primary_value',v_primary,'current_primary_observed_at',v_primary_at,
    'current_primary_source',v_primary_source,'current_isa_value',v_isa,
    'current_isa_capture_at',v_isa_at,'current_isa_balance_effective_at',v_isa_balance_at,
    'current_isa_source',v_isa_source,'current_isa_observation_id',v_isa_id,
    'account_identity_verified',false,
    'account_link_level',case when v_isa_id is not null
       then 'screen_account_split_amount_match_identifier_unverified'
       else 'previous_manual_balance' end,
    'isa_unexplained_change',case when v_isa_id is not null then v_isa-v_old_isa else null end,
    'isa_components_at',v_base->'manual_observed_at',
    'isa_total_only',v_isa_id is not null,
    'capture_times_aligned',v_primary_source='kb_account_breakdown_screenshot'
      and v_isa_source='kb_account_breakdown_screenshot'
  );
end $fn$;
revoke all on function public.get_live_current_account_scope() from public,anon;
grant execute on function public.get_live_current_account_scope() to authenticated;
