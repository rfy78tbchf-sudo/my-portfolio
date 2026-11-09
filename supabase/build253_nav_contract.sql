-- Shared interval semantics. Start is the first included activity day;
-- the opening valuation belongs to the preceding day, never that day's close.
create or replace function public.portfolio_period_start(p_period text,p_today date,p_first date default null)
returns date language plpgsql immutable set search_path='' as $$
begin
 return case upper(p_period)
 when '오늘' then p_today when 'TODAY' then p_today
 when '1W' then p_today-6
 when 'THIS_WEEK' then date_trunc('week',p_today)::date
 when 'THIS_MONTH' then date_trunc('month',p_today)::date
 when '1M' then (p_today-interval '1 month')::date
 when '3M' then (p_today-interval '3 months')::date
 when '6M' then (p_today-interval '6 months')::date
 when 'YTD' then date_trunc('year',p_today)::date
 when '1Y' then (p_today-interval '1 year')::date
 when 'ALL' then p_first
 else null end;
end $$;

-- This is an arithmetic assertion, NOT independent evidence of correctness.
-- Callers must separately validate scope, valuations, flows and component sources.
create or replace function public.portfolio_reconcile_values(p_open numeric,p_close numeric,p_flow numeric,p_components numeric)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('asset_pnl',p_close-p_open-p_flow,
 'component_pnl',p_components,'difference',p_close-p_open-p_flow-p_components,
 'arithmetic_matches',case when p_open is null or p_close is null or p_flow is null or p_components is null then null
 else p_close-p_open-p_flow=p_components end)
$$;

create or replace function public.get_live_nav_reconciliation(p_period text default '1M')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
  'scope','all_accounts','currency','KRW','calculation_version','nav-contract-253','data_version',v_version,
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
end $$;
revoke all on function public.get_live_nav_reconciliation(text) from public,anon;
grant execute on function public.get_live_nav_reconciliation(text) to authenticated;
revoke all on function public.portfolio_period_start(text,date,date) from public,anon;
revoke all on function public.portfolio_reconcile_values(numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.portfolio_period_start(text,date,date),public.portfolio_reconcile_values(numeric,numeric,numeric,numeric) to authenticated,service_role;
