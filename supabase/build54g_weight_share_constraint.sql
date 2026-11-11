-- Extend the target-weight calculation with a clearly hypothetical, cost-basis
-- P/L classification, without creating income or cash events in the ledger.
create or replace function public.get_live_weight_reduction_scenario(
  p_symbol text, p_target_pct numeric)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_metrics jsonb;
  v_value numeric;
  v_assets numeric;
  v_after numeric;
  v_sale numeric;
  v_cost numeric;
  v_valuation numeric;
  v_missing integer;
  v_count integer;
  v_allocated numeric;
  v_classification jsonb;
  v_quantity numeric;
  v_unit_value numeric;
  v_sell_shares numeric;
  v_feasible_sale numeric;
  v_quantity_case jsonb;
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
  select sum(h.cost_krw),sum(h.valuation_krw),
         count(*) filter(where h.cost_krw is null),count(*)
    into v_cost,v_valuation,v_missing,v_count
  from public.live_holding_display_basis h
  join public.securities s on s.id=h.security_id
  join public.accounts a on a.id=h.account_id
  where a.user_id=(select auth.uid()) and a.provider='kb_securities'
    and a.mode='live' and a.is_active and h.quantity>0
    and s.symbol=upper(trim(p_symbol));
  select sum(h.quantity) into v_quantity
  from public.live_holding_display_basis h
  join public.securities s on s.id=h.security_id
  join public.accounts a on a.id=h.account_id
  where a.user_id=(select auth.uid()) and a.provider='kb_securities'
    and a.mode='live' and a.is_active and h.quantity>0
    and s.symbol=upper(trim(p_symbol));
  if v_quantity>0 and v_quantity=trunc(v_quantity) and v_value>0 then
    v_unit_value:=v_value/v_quantity;
    v_sell_shares:=least(v_quantity,ceil(v_sale/v_unit_value));
    v_feasible_sale:=v_sell_shares*v_unit_value;
    v_quantity_case:=jsonb_build_object('status','integer_shares_estimate',
      'estimated_unit_value_krw',v_unit_value,
      'shares_to_sell',v_sell_shares,'sale_value_krw',v_feasible_sale,
      'remaining_position_krw',v_value-v_feasible_sale,
      'cash_increase_before_cost_krw',v_feasible_sale,
      'achieved_weight_pct',round((v_value-v_feasible_sale)/v_assets*100,4),
      'target_gap_pct',round((v_value-v_feasible_sale)/v_assets*100-p_target_pct,4),
      'note','Uses one average KRW valuation per share; no execution price or market lot verified');
  else v_quantity_case:=jsonb_build_object('status','quantity_or_price_unavailable');end if;
  if v_count>0 and v_missing=0 and v_cost is not null and v_value>0
     and abs(v_valuation-v_value)<0.01 then
    v_allocated:=v_cost*v_sale/v_value;
    v_classification:=jsonb_build_object('state','hypothetical_cost_basis_before_fees',
      'current_cost_basis_krw',v_cost,'allocated_cost_basis_krw',v_allocated,
      'hypothetical_realized_krw',v_sale-v_allocated,
      'hypothetical_remaining_unrealized_krw',v_after-(v_cost-v_allocated),
      'original_unrealized_krw',v_value-v_cost,
      'net_new_investment_pnl_krw',0);
  else
    v_classification:=jsonb_build_object('state','cost_basis_unavailable_or_misaligned');
  end if;
  return jsonb_build_object('ok',true,'calculation_version','weight-scenario-v3',
    'metrics_calculation_version',v_metrics->'calculation_version',
    'observation_at',v_metrics->'observation_at',
    'account_scope_state',v_metrics->'account_scope_state',
    'denominator',v_metrics->'denominator','position',v_metrics->'position',
    'scenario',jsonb_build_object('target_weight_pct',p_target_pct,
      'sale_value_krw',v_sale,'position_after_krw',v_after,
      'share_quantity_case',v_quantity_case,
      'cash_increase_before_cost_krw',v_sale,'pnl_classification',v_classification,
      'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
      'weight_after_pct',round(v_after/v_assets*100,4),
      'assumptions','No change in other prices, FX, fees or tax; proceeds held as cash',
      'state','conditional_reference_not_order'));
end $fn$;
revoke all on function public.get_live_weight_reduction_scenario(text,numeric) from public,anon;
grant execute on function public.get_live_weight_reduction_scenario(text,numeric) to authenticated;
