-- Cash from a foreign security remains foreign cash in this scenario.
-- No FX conversion is modeled; the KRW amount is a valuation reference only.
create or replace function public.get_live_choice_comparison(
  p_symbol text,p_target_pct numeric,p_down_pct numeric default -10,p_up_pct numeric default 10)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_now jsonb; v_reduce jsonb; v_cash jsonb;
declare v_before numeric; v_after numeric; v_assets numeric; v_quantity numeric;
declare v_cash_value numeric; v_position_currency text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_down_pct is null or p_down_pct>=0 or p_down_pct< -90
     or p_up_pct is null or p_up_pct<=0 or p_up_pct>100 then
    raise exception 'invalid price assumptions'; end if;
  v_now:=public.get_live_decision_metrics(p_symbol,0);
  if not coalesce((v_now->>'ok')::boolean,false) then return v_now; end if;
  if p_target_pct is null or p_target_pct<0 or
     p_target_pct>=(v_now->'position'->>'weight_pct')::numeric then
    return jsonb_build_object('ok',false,'reason','TARGET_MUST_BE_BELOW_CURRENT');end if;
  v_reduce:=public.get_live_weight_reduction_scenario(p_symbol,p_target_pct);
  if not coalesce((v_reduce->>'ok')::boolean,false) then return v_reduce;end if;
  v_before:=(v_now->'position'->>'value')::numeric;
  v_after:=(v_reduce->'scenario'->>'position_after_krw')::numeric;
  v_assets:=(v_now->'denominator'->>'value')::numeric;
  select sum(h.quantity) into v_quantity from public.live_holding_display_basis h
  join public.accounts a on a.id=h.account_id
  join public.securities s on s.id=h.security_id
  where a.user_id=(select auth.uid()) and a.provider='kb_securities'
    and a.mode='live' and a.is_active and h.quantity>0
    and s.symbol=upper(trim(p_symbol));
  select case when count(distinct s.currency)=1 then max(s.currency) else null end
    into v_position_currency from public.live_holding_display_basis h
    join public.accounts a on a.id=h.account_id join public.securities s on s.id=h.security_id
    where a.user_id=(select auth.uid()) and a.provider='kb_securities'
      and a.mode='live' and a.is_active and h.quantity>0 and s.symbol=upper(trim(p_symbol));
  v_cash:=public.get_live_cash_accounting(null);
  if v_cash->'krw'->>'status'='confirmed_cash_balance' and
    (v_cash->'krw'->>'anchor_date')::date=
    ((v_now->>'observation_at')::timestamptz at time zone 'Asia/Seoul')::date then
    v_cash_value:=(v_cash->'krw'->>'balance')::numeric;
  end if;
  return jsonb_build_object('ok',true,'calculation_version','choice-comparison-v1',
    'observation_at',v_now->'observation_at','account_scope_state',v_now->'account_scope_state',
    'price_assumptions',jsonb_build_object('down_pct',p_down_pct,'up_pct',p_up_pct),
    'position_currency',v_position_currency,
    'denominator',v_now->'denominator','quantity',v_quantity,
    'current_cash_kb_krw',v_cash_value,
    'hold',jsonb_build_object('value_krw',v_before,'quantity',v_quantity,
      'weight_pct',v_now->'position'->'weight_pct','cash_kb_krw',v_cash_value,
      'down_impact_krw',v_before*p_down_pct/100,'up_impact_krw',v_before*p_up_pct/100),
    'reduce',jsonb_build_object('value_krw',v_after,
      'quantity_reference',case when v_quantity is not null and v_before>0
        then v_quantity*v_after/v_before else null end,
      'weight_pct',v_reduce->'scenario'->'weight_after_pct',
      'cash_increase_krw',v_reduce->'scenario'->'cash_increase_before_cost_krw',
      'cash_kb_krw_reference',case when v_position_currency='KRW' and v_cash_value is not null
        then v_cash_value+(v_reduce->'scenario'->>'cash_increase_before_cost_krw')::numeric else null end,
      'down_impact_krw',v_after*p_down_pct/100,'up_impact_krw',v_after*p_up_pct/100,
      'share_quantity_case',v_reduce->'scenario'->'share_quantity_case'),
    'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
    'assumptions','Position KRW valuation changes, other assets and FX fixed; continuous target share reference; sell proceeds held as cash before fees and tax; no order or forecast');
end $fn$;

revoke all on function public.get_live_choice_comparison(text,numeric,numeric,numeric) from public,anon;
grant execute on function public.get_live_choice_comparison(text,numeric,numeric,numeric) to authenticated;
