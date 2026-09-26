-- Use the latest account total observation, while retaining the independently
-- observed position cut. Weights and scenarios are references across cuts.
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
