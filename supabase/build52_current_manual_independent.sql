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

  -- A screenshot supplies only the total; its capture time is never
  -- represented as a proven broker valuation time. It supersedes a manual
  -- observation only while no later manual observation exists.
  if v_manual_count=1 then
    select o.id,o.total_assets,o.captured_at,o.balance_effective_at,o.scope_evidence_id
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
    'account_identity_verified',false,
    'account_link_level',case when v_isa_id is not null
       then 'screen_account_split_amount_match_identifier_unverified'
       else 'latest_manual_balance_identifier_unverified' end,
    'broker_account_overlap_verified',coalesce((v_base->>'broker_account_overlap_verified')::boolean,false)
       and v_manual_count=1,
    'isa_unexplained_change',case when v_isa_id is not null and v_old_isa is not null
      then v_isa-v_old_isa else null end,
    'isa_components_at',v_manual_at,'isa_total_only',v_isa_id is not null,
    'capture_times_aligned',v_primary_source='kb_account_breakdown_screenshot'
      and v_isa_source='kb_account_breakdown_screenshot'
  );
end $fn$;
revoke all on function public.get_live_current_account_scope() from public,anon;
grant execute on function public.get_live_current_account_scope() to authenticated;
