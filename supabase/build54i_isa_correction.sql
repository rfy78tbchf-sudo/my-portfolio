-- Append-only correction for a user-uploaded ISA screenshot. No mutation to the
-- original observation, source image, historical NAV, positions, or cash.
create table public.account_total_observation_corrections (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.account_total_observations(id),
  user_id uuid not null,
  corrected_total numeric not null check(corrected_total>0 and corrected_total<1000000000000000),
  reason text not null check(length(trim(reason)) between 3 and 500),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index account_total_correction_latest on public.account_total_observation_corrections(observation_id,created_at desc,id desc);
alter table public.account_total_observation_corrections enable row level security;
create policy account_total_correction_owner_read on public.account_total_observation_corrections
  for select to authenticated using(user_id=(select auth.uid()));
create policy account_total_correction_owner_write on public.account_total_observation_corrections
  for insert to authenticated with check(user_id=(select auth.uid()) and exists(
    select 1 from public.account_total_observations o join public.accounts a on a.id=o.account_id
    where o.id=observation_id and a.user_id=(select auth.uid())
      and a.provider='kb_securities_manual' and o.verification_level='user_uploaded_unverified'
  ));
revoke all on public.account_total_observation_corrections from public,anon;
grant select on public.account_total_observation_corrections to authenticated;
grant insert(observation_id,user_id,corrected_total,reason,request_id)
  on public.account_total_observation_corrections to authenticated;

create or replace function public.correct_isa_total_observation(
  p_observation_id uuid,p_corrected_total numeric,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path to '' as $fn$
declare v_old record;v_id uuid;v_new boolean:=false;v_scope jsonb;
begin
  if (select auth.uid()) is null or p_request_id is null or p_observation_id is null
    then raise exception 'authentication required'; end if;
  if p_corrected_total is null or p_corrected_total<=0 or p_corrected_total>=1000000000000000
    or length(trim(coalesce(p_reason,''))) not between 3 and 500
    then raise exception 'invalid correction'; end if;
  select o.id,o.account_id into v_old from public.account_total_observations o
    join public.accounts a on a.id=o.account_id
    where o.id=p_observation_id and a.user_id=(select auth.uid()) and a.mode='live'
      and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual'
      and o.verification_level='user_uploaded_unverified' and o.storage_path is not null;
  if v_old.id is null then raise exception 'uploaded ISA observation not found'; end if;
  insert into public.account_total_observation_corrections
    (observation_id,user_id,corrected_total,reason,request_id)
  values (p_observation_id,(select auth.uid()),p_corrected_total,trim(p_reason),p_request_id)
  on conflict(user_id,request_id) do nothing returning id into v_id;
  if v_id is not null then v_new:=true;
  else select c.id into v_id from public.account_total_observation_corrections c
    where c.user_id=(select auth.uid()) and c.request_id=p_request_id
      and c.observation_id=p_observation_id and c.corrected_total=p_corrected_total
      and c.reason=trim(p_reason);
    if v_id is null then raise exception 'request id already used with different correction';end if;
  end if;
  v_scope:=public.get_live_current_account_scope();
  return jsonb_build_object('ok',true,'correction_id',v_id,'inserted',v_new,
    'current',v_scope->>'current_isa_correction_id'=v_id::text,
    'current_total',v_scope->'current_display_total');
end $fn$;
revoke all on function public.correct_isa_total_observation(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.correct_isa_total_observation(uuid,numeric,text,uuid) to authenticated;

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
  v_isa_correction_id uuid;
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
    select o.id,o.account_id,coalesce(c.corrected_total,o.total_assets) total_assets,o.captured_at,o.balance_effective_at,
      o.scope_evidence_id,o.storage_path,c.id correction_id
      into v_observation
    from public.account_total_observations o
    left join lateral (select x.id,x.corrected_total from public.account_total_observation_corrections x
      where x.observation_id=o.id order by x.created_at desc,x.id desc limit 1) c on true
    join public.accounts a on a.id=o.account_id
    where a.user_id=(select auth.uid()) and a.provider='kb_securities_manual'
      and a.mode='live' and a.is_active
      and (v_isa_at is null or o.captured_at>v_isa_at)
    order by o.captured_at desc,o.recorded_at desc limit 1;
    if v_observation.id is not null then
      v_isa_id:=v_observation.id;
      v_isa_correction_id:=v_observation.correction_id;
      v_isa:=v_observation.total_assets;
      v_isa_at:=v_observation.captured_at;
      v_isa_balance_at:=v_observation.balance_effective_at;
      v_isa_source:=case when v_observation.scope_evidence_id is null
        then 'user_uploaded_isa_screenshot' else 'kb_account_breakdown_screenshot' end;
      v_isa_storage_path:=v_observation.storage_path;
      -- Explain the change since the latest earlier total, rather than always
      -- comparing a new screenshot to the 9/23 manual composition.
      select coalesce(pc.corrected_total,prior.total_assets) into v_previous_isa
      from public.account_total_observations prior
      left join lateral (select x.corrected_total from public.account_total_observation_corrections x
        where x.observation_id=prior.id order by x.created_at desc,x.id desc limit 1) pc on true
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
    'current_isa_correction_id',v_isa_correction_id,
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

create or replace function public.get_live_decision_metrics(
  p_symbol text default 'ARM', p_change_pct numeric default -10)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_scope jsonb;
  v_as_of timestamptz;
  v_total numeric;
  v_missing integer;
  v_stale integer;
  v_position numeric;
  v_top_three numeric;
  v_symbol text := upper(trim(coalesce(p_symbol,'')));
  v_broker_separate boolean;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_symbol !~ '^[A-Z0-9.]{1,15}$' or p_change_pct is null
    or p_change_pct < -90 or p_change_pct > 100 then
    raise exception 'invalid scenario inputs';
  end if;
  select a.id into v_account from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live'
    and a.provider='kb_securities' and a.is_active
  order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_ACCOUNT'); end if;
  v_scope:=public.get_live_current_account_scope();
  v_as_of:=(v_scope->>'snapshot_at')::timestamptz;
  v_total:=(v_scope->>'current_display_total')::numeric;
  v_broker_separate:=coalesce((v_scope->>'broker_account_overlap_verified')::boolean,false);
  if v_as_of is null or v_total is null or v_total<=0 then
    return jsonb_build_object('ok',false,'reason','NO_ALIGNED_ASSETS');
  end if;
  with positions as (
    select h.security_id,s.symbol,h.valuation_krw,h.as_of
    from public.live_holding_display_basis h
    join public.securities s on s.id=h.security_id
    where h.account_id=v_account and h.quantity>0
  ), by_security as (
    select symbol,sum(valuation_krw) val,count(*) filter (where valuation_krw is null) missing,
      count(*) filter (where as_of is distinct from v_as_of) stale
    from positions group by symbol
  ), ranked as (
    select *,row_number() over(order by val desc nulls last,symbol) rank from by_security
  )
  select coalesce(sum(missing),0)::integer,coalesce(sum(stale),0)::integer,
    sum(val) filter (where symbol=v_symbol),sum(val) filter (where rank<=3)
  into v_missing,v_stale,v_position,v_top_three from ranked;
  if v_missing>0 or v_stale>0 then
    return jsonb_build_object('ok',false,'reason','POSITION_VALUATION_NOT_ALIGNED',
      'missing',v_missing,'stale',v_stale,'observed_at',v_as_of);
  end if;
  if v_position is null then return jsonb_build_object('ok',false,'reason','SYMBOL_NOT_HELD'); end if;
  return jsonb_build_object(
    'ok',true,'calculation_version','decision-metrics-v3',
    'observation_at',v_as_of,'account_scope','KB 자동계좌 보유 + 앱 저장 자산 분모',
    'account_scope_state',case when v_broker_separate then 'verified' else 'isa_overlap_unverified' end,
    'denominator',jsonb_build_object('metric_id','app_display_assets','value',v_total,
      'currency','KRW','label',case when v_broker_separate
        then 'KB 자동계좌 + 최신 ISA 총액 (평가시각 미확인)'
        else '앱 합산 자산 (ISA 포함 여부 미확인)' end,
      'kb_response_value',v_scope->'kb_response_total',
      'manual_overlay',v_scope->'current_isa_value','observed_at',v_scope->'current_primary_observed_at',
      'primary_observed_at',v_scope->'current_primary_observed_at',
      'isa_captured_at',v_scope->'current_isa_capture_at',
      'isa_balance_effective_at',v_scope->'current_isa_balance_effective_at',
      'isa_observation_id',v_scope->'current_isa_observation_id',
      'isa_correction_id',v_scope->'current_isa_correction_id',
      'account_identifier_verified',v_scope->'account_identity_verified',
      'component_state',case when v_scope->>'isa_total_only'='true' then 'isa_total_only' else 'manual_components_available' end,
      'position_observed_at',v_as_of,
      'cutoff_state','mixed_account_cuts_reference',
      'broker_scope_capture_at',v_scope->'broker_scope_capture_at',
      'account_scope_state',case when v_broker_separate then 'separate_accounts_observed'
        else 'not_verified' end),
    'position',jsonb_build_object('metric_id','position_value:'||v_symbol,
      'symbol',v_symbol,'value',v_position,'currency','KRW',
      'weight_pct',round(v_position/v_total*100,4),'observed_at',v_as_of),
    'top_three',jsonb_build_object('metric_id','top_three_value','value',v_top_three,
      'currency','KRW','weight_pct',round(v_top_three/v_total*100,4)),
    'scenario',jsonb_build_object('metric_id','scenario:'||v_symbol||':'||p_change_pct,
      'assumption_pct',p_change_pct,'impact_krw',v_position*p_change_pct/100,
      'asset_impact_pct',round(v_position*p_change_pct/v_total,4),
      'asset_after_krw',v_total+v_position*p_change_pct/100,
      'assumption','해당 종목 원화 평가액만 변하고 나머지 자산은 동일',
      'state','conditional_reference_not_forecast'));
end $fn$;
revoke all on function public.get_live_decision_metrics(text,numeric) from public,anon;
grant execute on function public.get_live_decision_metrics(text,numeric) to authenticated;

alter table public.ai_analysis_history add column if not exists isa_correction_id uuid;
