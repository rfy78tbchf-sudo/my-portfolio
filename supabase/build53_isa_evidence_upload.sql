-- An authenticated owner can save a newer ISA total together with its private
-- screenshot. The old daily snapshot, position details and cash flow stay put.
alter table public.account_total_observations
  alter column scope_evidence_id drop not null,
  add column if not exists storage_path text;
alter table public.account_total_observations
  drop constraint account_total_observations_verification_level_check;
alter table public.account_total_observations
  add constraint account_total_observations_verification_level_check
  check (verification_level in
    ('broker_screen_amount_identifier_unverified','broker_account_identifier_matched',
     'user_uploaded_unverified'));
alter table public.account_total_observations
  add constraint account_total_observations_uploaded_source_check
  check (verification_level <> 'user_uploaded_unverified' or
    (scope_evidence_id is null and storage_path is not null and
     source_reference='user_uploaded_isa:'||storage_path));

create policy isa_total_evidence_upload on storage.objects
  for insert to authenticated with check (
    bucket_id='reconciliation-evidence' and
    name ~ '^[0-9a-f-]{36}/isa/[0-9a-f]{64}\.(png|jpg|heic|heif)$' and
    exists(select 1 from public.accounts a
      where a.id::text=split_part(storage.objects.name,'/',1)
        and a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
        and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual')
  );
create policy isa_total_evidence_read on storage.objects
  for select to authenticated using (
    bucket_id='reconciliation-evidence' and
    name ~ '^[0-9a-f-]{36}/isa/[0-9a-f]{64}\.(png|jpg|heic|heif)$' and
    exists(select 1 from public.accounts a
      where a.id::text=split_part(storage.objects.name,'/',1)
        and a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
        and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual')
  );
create policy account_total_observations_owner_upload on public.account_total_observations
  for insert to authenticated with check (
    verification_level='user_uploaded_unverified' and scope_evidence_id is null and
    storage_path is not null and source_reference='user_uploaded_isa:'||storage_path and
    exists(select 1 from public.accounts a where a.id=account_id
      and a.user_id=(select auth.uid()) and a.provider='kb_securities_manual'
      and a.provider_account_ref='isa-manual' and a.mode='live' and a.is_active)
  );
grant insert(account_id,scope_evidence_id,total_assets,captured_at,
  balance_effective_at,source_reference,verification_level,component_state,storage_path)
  on public.account_total_observations to authenticated;

create or replace function public.save_isa_total_from_evidence(
  p_total_assets numeric,p_captured_at timestamptz,p_storage_path text)
returns jsonb language plpgsql security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_id uuid;
  v_prior record;
  v_scope jsonb;
  v_new boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_total_assets is null or p_total_assets <= 0 or p_total_assets >= 1000000000000000 then
    raise exception 'invalid ISA amount'; end if;
  if p_captured_at is null or p_captured_at<'2000-01-01'::timestamptz or
    p_captured_at>now()+interval '5 minutes' then raise exception 'invalid capture time'; end if;
  select a.id into v_account from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual'
  order by a.created_at limit 1;
  if v_account is null then raise exception 'ISA account not found'; end if;
  if p_storage_path !~ ('^'||v_account::text||'/isa/[0-9a-f]{64}\.(png|jpg|heic|heif)$') then
    raise exception 'invalid evidence path'; end if;
  if not exists(select 1 from storage.objects o
    where o.bucket_id='reconciliation-evidence' and o.name=p_storage_path) then
    raise exception 'ISA screenshot not uploaded'; end if;
  insert into public.account_total_observations (
    account_id,scope_evidence_id,total_assets,captured_at,balance_effective_at,
    source_reference,verification_level,component_state,storage_path)
  values(v_account,null,p_total_assets,p_captured_at,null,
    'user_uploaded_isa:'||p_storage_path,'user_uploaded_unverified',
    'account_total_only',p_storage_path)
  on conflict(account_id,source_reference) do nothing returning id into v_id;
  if v_id is not null then v_new:=true;
  else
    select o.id,o.total_assets,o.captured_at into v_prior
    from public.account_total_observations o
    where o.account_id=v_account and o.source_reference='user_uploaded_isa:'||p_storage_path;
    if v_prior.id is null or v_prior.total_assets is distinct from p_total_assets or
       v_prior.captured_at is distinct from p_captured_at then
      raise exception 'same screenshot already registered with different values'; end if;
    v_id:=v_prior.id;
  end if;
  v_scope:=public.get_live_current_account_scope();
  return jsonb_build_object('ok',true,'observation_id',v_id,'inserted',v_new,
    'used_as_current',v_scope->>'current_isa_observation_id'=v_id::text,
    'current_total',v_scope->'current_display_total');
end $fn$;
revoke all on function public.save_isa_total_from_evidence(numeric,timestamptz,text) from public,anon;
grant execute on function public.save_isa_total_from_evidence(numeric,timestamptz,text) to authenticated;
-- The historical daily NAV remains tied to the KB snapshot date. The current
-- account total is selected independently so a newer ISA observation still
-- appears when KB has not produced a new daily snapshot (e.g. a weekend).
create or replace function public.get_live_current_account_scope()
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_base jsonb := public.get_live_account_scope();
  v_old_isa numeric;
  v_manual_total numeric;
  v_manual_at timestamptz;
  v_manual_count integer;
  v_previous_isa numeric;
  v_isa numeric;
  v_isa_at timestamptz;
  v_isa_id uuid;
  v_isa_balance_at timestamptz;
  v_primary numeric;
  v_primary_at timestamptz;
  v_primary_source text := 'kb_api_response';
  v_isa_source text := 'manual_snapshot';
  v_isa_storage_path text;
  v_observation record;
  v_evidence public.kb_account_scope_evidence%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_base is null or (v_base->>'ok')::boolean is distinct from true then return v_base; end if;
  v_primary:=(v_base->>'kb_response_total')::numeric;
  v_primary_at:=(v_base->>'snapshot_at')::timestamptz;
  v_old_isa:=(v_base->>'manual_current_total')::numeric;

  -- Unlike get_live_account_scope(), this selection is not limited to the
  -- last KB snapshot_date. It never rewrites that historical observation.
  select sum(m.total_assets),max(m.snapshot_at),count(*)
    into v_manual_total,v_manual_at,v_manual_count
  from (
    select distinct on (x.subaccount_key) x.total_assets,x.snapshot_at
    from public.manual_subaccount_snapshots x
    where x.user_id=(select auth.uid()) and x.provider='kb_securities' and x.active
    order by x.subaccount_key,x.snapshot_date desc,x.snapshot_at desc,x.created_at desc
  ) m;
  v_isa:=v_manual_total;
  v_isa_at:=v_manual_at;
  v_previous_isa:=coalesce(v_manual_total,v_old_isa);

  -- A screenshot supplies only the total; its capture time is never
  -- represented as a proven broker valuation time. It supersedes a manual
  -- observation only while no later manual observation exists.
  if v_manual_count=1 then
    select o.id,o.account_id,o.total_assets,o.captured_at,o.balance_effective_at,
      o.scope_evidence_id,o.storage_path
      into v_observation
    from public.account_total_observations o
    join public.accounts a on a.id=o.account_id
    where a.user_id=(select auth.uid()) and a.provider='kb_securities_manual'
      and a.mode='live' and a.is_active
      and (v_isa_at is null or o.captured_at>v_isa_at)
    order by o.captured_at desc,o.recorded_at desc limit 1;
    if v_observation.id is not null then
      v_isa_id:=v_observation.id;
      v_isa:=v_observation.total_assets;
      v_isa_at:=v_observation.captured_at;
      v_isa_balance_at:=v_observation.balance_effective_at;
      v_isa_source:=case when v_observation.scope_evidence_id is null
        then 'user_uploaded_isa_screenshot' else 'kb_account_breakdown_screenshot' end;
      v_isa_storage_path:=v_observation.storage_path;
      -- Explain the change since the latest earlier total, rather than always
      -- comparing a new screenshot to the 9/23 manual composition.
      select prior.total_assets into v_previous_isa
      from public.account_total_observations prior
      where prior.account_id=v_observation.account_id
        and prior.captured_at<v_observation.captured_at
        and (v_manual_at is null or prior.captured_at>v_manual_at)
      order by prior.captured_at desc,prior.recorded_at desc limit 1;
      v_previous_isa:=coalesce(v_previous_isa,v_manual_total,v_old_isa);
      select e.* into v_evidence from public.kb_account_scope_evidence e
        join public.accounts a on a.id=e.account_id
        where e.id=v_observation.scope_evidence_id and a.user_id=(select auth.uid());
      if v_evidence.id is not null and v_evidence.broker_capture_at>=v_primary_at then
        v_primary:=v_evidence.broker_primary_total;
        v_primary_at:=v_evidence.broker_capture_at;
        v_primary_source:='kb_account_breakdown_screenshot';
      end if;
    end if;
  end if;
  return v_base || jsonb_build_object(
    'manual_current_total',v_manual_total,'manual_observed_at',v_manual_at,
    'manual_count',v_manual_count,'manual_snapshot_stale',v_manual_at<v_primary_at,
    'current_display_total',case when v_primary is not null and v_isa is not null
      then v_primary+v_isa else null end,
    'current_primary_value',v_primary,'current_primary_observed_at',v_primary_at,
    'current_primary_source',v_primary_source,'current_isa_value',v_isa,
    'current_isa_capture_at',v_isa_at,'current_isa_balance_effective_at',v_isa_balance_at,
    'current_isa_source',v_isa_source,'current_isa_observation_id',v_isa_id,
    'current_isa_storage_path',v_isa_storage_path,
    'account_identity_verified',false,
    'account_link_level',case when v_isa_storage_path is not null
       then 'user_uploaded_total_prior_split_identifier_unverified'
       when v_isa_id is not null then 'screen_account_split_amount_match_identifier_unverified'
       else 'latest_manual_balance_identifier_unverified' end,
    'broker_account_overlap_verified',coalesce((v_base->>'broker_account_overlap_verified')::boolean,false)
       and v_manual_count=1,
    'isa_unexplained_change',case when v_isa_id is not null and v_previous_isa is not null
      then v_isa-v_previous_isa else null end,
    'isa_components_at',v_manual_at,'isa_total_only',v_isa_id is not null,
    'capture_times_aligned',v_primary_source='kb_account_breakdown_screenshot'
      and v_isa_source='kb_account_breakdown_screenshot'
  );
end $fn$;
revoke all on function public.get_live_current_account_scope() from public,anon;
grant execute on function public.get_live_current_account_scope() to authenticated;
