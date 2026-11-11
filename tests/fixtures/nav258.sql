-- Read-only production function definitions captured for an isolated synthetic fixture.
-- No operational financial rows or user-specific values are included.
create table public.account_total_observation_corrections (id uuid,observation_id uuid,user_id uuid,corrected_total numeric,reason text,request_id uuid,created_at timestamp with time zone);
create table public.account_total_observations (id uuid,account_id uuid,scope_evidence_id uuid,total_assets numeric,captured_at timestamp with time zone,balance_effective_at timestamp with time zone,source_reference text,verification_level text,component_state text,recorded_at timestamp with time zone,storage_path text);
create table public.cash_flows (id uuid,account_id uuid,occurred_at timestamp with time zone,type text,amount numeric,currency text,fx_rate_to_base numeric,external_id text,source text,created_at timestamp with time zone,updated_at timestamp with time zone);
create table public.daily_performance_evidence (account_id uuid,source text,start_date date,end_date date,start_nav numeric,end_nav numeric,external_flow numeric,investment_pnl numeric,rate_estimate_pct numeric,quality text,cash_bridge_gap numeric,nav_component_drift numeric,flow_source_confirmed boolean,snapshot_valuation_aligned boolean,price_coverage jsonb,limitations jsonb,calculated_at timestamp with time zone);
create table public.kb_account_scope_evidence (id uuid,account_id uuid,manual_account_id uuid,linked_snapshot_at timestamp with time zone,broker_capture_at timestamp with time zone,broker_primary_total numeric,broker_isa_total numeric,broker_aggregate_total numeric,source_reference text,created_at timestamp with time zone);
create table public.manual_adjustments (id uuid,user_id uuid,account_id uuid,security_id uuid,occurred_on date,kind text,amount numeric,currency text,note text,active boolean,created_at timestamp with time zone,updated_at timestamp with time zone);
create table public.manual_subaccount_snapshots (id uuid,user_id uuid,provider text,subaccount_key text,account_name text,snapshot_date date,snapshot_at timestamp with time zone,total_assets numeric,cash numeric,securities_value numeric,invested_capital numeric,unrealized_pnl numeric,daily_realized_pnl numeric,holdings jsonb,source text,note text,active boolean,created_at timestamp with time zone,updated_at timestamp with time zone);
create table public.sync_logs (id uuid,account_id uuid,started_at timestamp with time zone,finished_at timestamp with time zone,status text,scope text,rows_read integer,rows_written integer,error_code text,error_message text,detail jsonb);
CREATE OR REPLACE FUNCTION public.cash_flow_balance_date(p_flow_id uuid)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_flow public.cash_flows%rowtype;
  v_day date;
  v_prev public.daily_account_snapshots%rowtype;
  v_book public.daily_account_snapshots%rowtype;
  v_next public.daily_account_snapshots%rowtype;
  v_amount numeric;
  v_tolerance numeric;
begin
  select * into v_flow from public.cash_flows where id=p_flow_id;
  if not found or v_flow.source<>'api' or v_flow.currency<>'KRW'
     or abs(v_flow.amount)<100000 then return null; end if;
  v_day := (v_flow.occurred_at at time zone 'Asia/Seoul')::date;
  v_amount := v_flow.amount*coalesce(v_flow.fx_rate_to_base,1);
  select * into v_book from public.daily_account_snapshots
    where account_id=v_flow.account_id and snapshot_date=v_day;
  if not found or v_flow.occurred_at>v_book.snapshot_at then return null; end if;
  select * into v_prev from public.daily_account_snapshots
    where account_id=v_flow.account_id and snapshot_date<v_day
    order by snapshot_date desc limit 1;
  if not found then return null; end if;
  select * into v_next from public.daily_account_snapshots
    where account_id=v_flow.account_id and snapshot_date>v_day
      and snapshot_date<=v_day+3
    order by snapshot_date limit 1;
  if not found then return null; end if;
  -- Do not infer the timing when other flows could explain the same balance.
  if exists (select 1 from public.cash_flows c
      where c.account_id=v_flow.account_id and c.id<>v_flow.id
        and (c.occurred_at at time zone 'Asia/Seoul')::date
            between v_day and v_next.snapshot_date)
     or exists (select 1 from public.manual_adjustments m
      where m.account_id=v_flow.account_id and m.active and m.kind='external_flow'
        and m.occurred_on between v_day and v_next.snapshot_date) then
    return null;
  end if;
  v_tolerance:=greatest(120000,abs(v_amount)*0.04);
  -- Strip the broker's marked-to-market P&L from each asset change. The
  -- cash-like remainder is absent on the ledger day and appears next time.
  if abs((v_book.total_assets-v_prev.total_assets)
      -(coalesce(v_book.unrealized_pnl,0)-coalesce(v_prev.unrealized_pnl,0)))<=v_tolerance
     and abs((v_next.total_assets-v_book.total_assets)
      -(coalesce(v_next.unrealized_pnl,0)-coalesce(v_book.unrealized_pnl,0))
      -v_amount)<=v_tolerance then
    return v_next.snapshot_date;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.allocated_external_flow(p_account_id uuid, p_previous_at timestamp with time zone, p_previous_date date, p_snapshot_at timestamp with time zone, p_snapshot_date date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(sum(c.amount*coalesce(c.fx_rate_to_base,1)),0)
  from public.cash_flows c
  where c.account_id=p_account_id and (
    case when public.cash_flow_balance_date(c.id) is not null then
      public.cash_flow_balance_date(c.id)>coalesce(p_previous_date,p_snapshot_date-1)
      and public.cash_flow_balance_date(c.id)<=p_snapshot_date
    else c.occurred_at>coalesce(p_previous_at,p_snapshot_date::timestamp at time zone 'Asia/Seoul')
      and c.occurred_at<=p_snapshot_at end
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_live_account_scope()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with target as (
  select s.account_id,s.snapshot_date,s.snapshot_at,s.total_assets,s.cash,s.securities_value,
    a.user_id
  from public.daily_account_snapshots s
  join public.accounts a on a.id=s.account_id
  where a.user_id=(select auth.uid()) and a.mode='live'
    and a.provider='kb_securities' and a.is_active
  order by s.snapshot_at desc limit 1
), matched as (
  select t.*,l.detail,(l.started_at is not null) has_source_log
  from target t left join lateral (
    select x.started_at,x.detail from public.sync_logs x
    where x.account_id=t.account_id and x.scope='kb_current_snapshot'
      and x.status='success' and x.started_at=t.snapshot_at
    order by x.id desc limit 1
  ) l on true
), manual as (
  select m.user_id,sum(m.total_assets) total_assets,count(*) account_count,
    max(m.snapshot_at) latest_observed_at
  from (
    select distinct on (x.subaccount_key) x.user_id,x.total_assets,x.snapshot_at
    from public.manual_subaccount_snapshots x
    join target t on x.snapshot_date<=t.snapshot_date and x.user_id=t.user_id
    where x.active order by x.subaccount_key,x.snapshot_date desc,x.snapshot_at desc
  ) m group by m.user_id
), evidence as (
  select e.* from matched s
  join public.kb_account_scope_evidence e on e.account_id=s.account_id
  join public.accounts ma on ma.id=e.manual_account_id and ma.user_id=s.user_id
    and ma.mode='live' and ma.provider='kb_securities_manual' and ma.is_active
  where e.linked_snapshot_at<=s.snapshot_at
    and s.has_source_log and s.detail ? 'manual_overlay_assets'
    and e.broker_primary_total=s.total_assets-(s.detail->>'manual_overlay_assets')::numeric
  order by e.linked_snapshot_at desc limit 1
)
select jsonb_build_object(
  'ok',true,'snapshot_at',s.snapshot_at,'snapshot_date',s.snapshot_date,
  'app_display_total',s.total_assets,'app_display_cash',s.cash,
  'app_display_securities',s.securities_value,
  'kb_response_total',case when s.has_source_log and s.detail ? 'manual_overlay_assets'
    then s.total_assets-(s.detail->>'manual_overlay_assets')::numeric else null end,
  'overlay_logged',case when s.has_source_log and s.detail ? 'manual_overlay_assets'
    then (s.detail->>'manual_overlay_assets')::numeric else null end,
  'manual_current_total',m.total_assets,'manual_count',m.account_count,
  'manual_observed_at',m.latest_observed_at,
  'manual_snapshot_stale',m.latest_observed_at<s.snapshot_at,
  'overlay_matches_manual',s.has_source_log and m.total_assets=(s.detail->>'manual_overlay_assets')::numeric,
  'broker_account_overlap_verified',coalesce(e.id is not null and s.has_source_log
    and m.account_count=1 and m.total_assets=(s.detail->>'manual_overlay_assets')::numeric,false),
  'broker_scope_capture_at',e.broker_capture_at,
  'broker_scope_primary_value',e.broker_primary_total,
  'broker_scope_isa_value',e.broker_isa_total,
  'broker_scope_total_value',e.broker_aggregate_total,
  'broker_scope_evidence_source',e.source_reference,
  'method',case when e.id is not null then 'broker_screen_amount_match_identifier_unverified'
    else 'saved_app_total_minus_exact_sync_manual_overlay' end
) from matched s left join manual m on m.user_id=s.user_id
  left join evidence e on e.account_id=s.account_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_live_current_account_scope()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.get_live_nav_reconciliation(p_period text DEFAULT '1M'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 v_user uuid := auth.uid(); v_account uuid; v_today date := timezone('Asia/Seoul',now())::date;
 v_start date; v_first date; v_base public.daily_account_snapshots%rowtype; v_end public.daily_account_snapshots%rowtype;
 v_open_overlay numeric; v_close_overlay numeric; v_flow numeric; v_scope jsonb;
 v_reasons jsonb := '[]'; v_version text; v_flow_confirmed boolean; v_days integer;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 select id into v_account from public.accounts where user_id=v_user and mode='live' and is_active and provider='kb_securities' order by created_at limit 1;
 if v_account is null then return jsonb_build_object('ok',false,'code','NO_LIVE_ACCOUNT'); end if;
 select min((coalesce(order_at,trade_at) at time zone 'Asia/Seoul')::date) into v_first from public.transactions where account_id=v_account;
 v_start:=public.portfolio_period_start(p_period,v_today,v_first);
 if v_start is null then return jsonb_build_object('ok',false,'code','PERIOD_START_UNAVAILABLE','period',p_period); end if;
 select * into v_base from public.daily_account_snapshots where account_id=v_account and snapshot_date=v_start-1;
 select * into v_end from public.daily_account_snapshots where account_id=v_account and snapshot_date between v_start and v_today order by snapshot_date desc limit 1;
 select (detail->>'manual_overlay_assets')::numeric into v_open_overlay from public.sync_logs
 where account_id=v_account and scope='kb_current_snapshot' and status='success' and started_at=v_base.snapshot_at order by id desc limit 1;
 select (detail->>'manual_overlay_assets')::numeric into v_close_overlay from public.sync_logs
 where account_id=v_account and scope='kb_current_snapshot' and status='success' and started_at=v_end.snapshot_at order by id desc limit 1;
 if v_base.id is null then v_reasons:=v_reasons||'"OPENING_NAV_MISSING"'::jsonb; end if;
 if v_end.id is null then v_reasons:=v_reasons||'"CLOSING_NAV_MISSING"'::jsonb; end if;
 if v_open_overlay is null or v_close_overlay is null then v_reasons:=v_reasons||'"ACCOUNT_SCOPE_EVIDENCE_MISSING"'::jsonb; end if;
 v_scope:=public.get_live_current_account_scope();
 if exists(select 1 from public.accounts where user_id=v_user and mode='live' and is_active and id<>v_account) then
   v_reasons:=v_reasons||'"OTHER_ACCOUNT_PERIOD_EVIDENCE_MISSING"'::jsonb;
 end if;
 if v_base.id is not null and v_end.id is not null then
   v_flow:=public.allocated_external_flow(v_account,v_base.snapshot_at,v_base.snapshot_date,v_end.snapshot_at,v_end.snapshot_date)
    +coalesce((select sum(amount) from public.manual_adjustments where user_id=v_user and account_id=v_account and active and kind='external_flow' and occurred_on>=v_start and occurred_on<=v_end.snapshot_date),0);
   select count(*),bool_and(flow_source_confirmed) into v_days,v_flow_confirmed from public.daily_performance_evidence
    where account_id=v_account and source='kb_current_snapshot' and end_date between v_start and v_end.snapshot_date;
   v_flow_confirmed:=coalesce(v_flow_confirmed,false) and v_days=v_end.snapshot_date-v_base.snapshot_date;
 end if;
 if v_flow_confirmed is distinct from true then v_reasons:=v_reasons||'"EXTERNAL_FLOW_COVERAGE_UNVERIFIED"'::jsonb; end if;
 if v_base.total_assets-v_base.cash-v_base.securities_value<>0 or v_end.total_assets-v_end.cash-v_end.securities_value<>0 then
   v_reasons:=v_reasons||'"SETTLEMENT_COMPONENTS_UNRECONCILED"'::jsonb;
 end if;
 -- No original-currency cash series or independent full-component reconstruction
 -- is available in the current schema. Never manufacture these from NAV residuals.
 v_reasons:=v_reasons||'["CASH_FX_COMPONENTS_UNVERIFIED","INDEPENDENT_COMPONENT_RECONSTRUCTION_PENDING"]'::jsonb;
 select md5(jsonb_build_object('base',to_jsonb(v_base),'end',to_jsonb(v_end),'scope',v_scope,
  'transactions',(select jsonb_build_array(count(*),max(updated_at)) from public.transactions where account_id=v_account),
  'flows',(select jsonb_build_array(count(*),max(updated_at)) from public.cash_flows where account_id=v_account))::text) into v_version;
 return jsonb_build_object('ok',true,'period',p_period,'period_start',v_start,'period_end',v_today,
  'opening_date',v_start-1,'opening_at',v_base.snapshot_at,'closing_at',v_end.snapshot_at,
  'scope','all_accounts','currency','KRW','calculation_version','nav-contract-254','data_version',v_version,
  'whole_pnl_verified',false,'components_verified',false,'whole_pnl',null,'reasons',v_reasons,
  'recorded_opening_nav',v_base.total_assets,'recorded_closing_nav',v_end.total_assets,
  'recorded_asset_change',v_end.total_assets-v_base.total_assets,
  'primary_opening_nav',v_base.total_assets-v_open_overlay,'primary_closing_nav',v_end.total_assets-v_close_overlay,
  'recorded_external_flow',v_flow,'external_flow_confirmed',v_flow_confirmed,
  'primary_asset_path_pnl',v_end.total_assets-v_close_overlay-(v_base.total_assets-v_open_overlay)-v_flow,
  'opening_component_gap',v_base.total_assets-v_base.cash-v_base.securities_value,
  'closing_component_gap',v_end.total_assets-v_end.cash-v_end.securities_value,
  'current_display_total',v_scope->'current_display_total','isa_observed_at',v_scope->'current_isa_capture_at',
  'identity',public.portfolio_reconcile_values(v_base.total_assets-v_open_overlay,v_end.total_assets-v_close_overlay,v_flow,null));
end $function$;

