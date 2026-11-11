-- User-selected target weight, with sale proceeds held as internal cash.
-- Reuse the exact same asset denominator and position valuation as risk/AI.
create or replace function public.get_live_weight_reduction_scenario(
  p_symbol text, p_target_pct numeric)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_metrics jsonb;
  v_value numeric;
  v_assets numeric;
  v_after numeric;
  v_sale numeric;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_target_pct is null or p_target_pct < 0 or p_target_pct > 100 then
    raise exception 'invalid target weight';
  end if;
  v_metrics:=public.get_live_decision_metrics(p_symbol,0);
  if not coalesce((v_metrics->>'ok')::boolean,false) then return v_metrics; end if;
  v_value:=(v_metrics->'position'->>'value')::numeric;
  v_assets:=(v_metrics->'denominator'->>'value')::numeric;
  v_after:=v_assets*p_target_pct/100;
  if v_after>v_value then
    return jsonb_build_object('ok',false,'reason','TARGET_EXCEEDS_CURRENT_WEIGHT',
      'current_weight_pct',v_metrics->'position'->'weight_pct');
  end if;
  v_sale:=v_value-v_after;
  return jsonb_build_object('ok',true,'calculation_version','weight-scenario-v1',
    'metrics_calculation_version',v_metrics->'calculation_version',
    'observation_at',v_metrics->'observation_at',
    'account_scope_state',v_metrics->'account_scope_state',
    'denominator',v_metrics->'denominator','position',v_metrics->'position',
    'scenario',jsonb_build_object('target_weight_pct',p_target_pct,
      'sale_value_krw',v_sale,'position_after_krw',v_after,
      'cash_increase_before_cost_krw',v_sale,
      'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
      'weight_after_pct',round(v_after/v_assets*100,4),
      'assumptions','No change in other prices, FX, fees or tax; proceeds held as cash',
      'state','conditional_reference_not_order'));
end $fn$;
revoke all on function public.get_live_weight_reduction_scenario(text,numeric) from public,anon;
grant execute on function public.get_live_weight_reduction_scenario(text,numeric) to authenticated;
