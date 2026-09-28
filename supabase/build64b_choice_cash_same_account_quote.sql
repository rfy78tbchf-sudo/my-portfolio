-- Keep native-currency and KRW sale proceeds on the same broker valuation basis.
create or replace function public.get_live_choice_comparison(
  p_symbol text,p_target_pct numeric,p_down_pct numeric default -10,p_up_pct numeric default 10)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_now jsonb; v_reduce jsonb; v_cash jsonb; v_case jsonb;
declare v_before numeric; v_exact numeric; v_after numeric; v_assets numeric; v_quantity numeric;
declare v_sold numeric; v_cash_value numeric; v_position_currency text; v_integer boolean;
declare v_native_total numeric; v_native_krw_total numeric; v_native_rows integer; v_holding_rows integer;
declare v_account uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_down_pct is null or p_down_pct>=0 or p_down_pct< -90
     or p_up_pct is null or p_up_pct<=0 or p_up_pct>100 then
    raise exception 'invalid price assumptions'; end if;
  v_now:=public.get_live_decision_metrics(p_symbol,0);
  if not coalesce((v_now->>'ok')::boolean,false) then return v_now; end if;
  if p_target_pct is null or p_target_pct<0 or
     p_target_pct>=(v_now->'position'->>'weight_pct')::numeric then
    return jsonb_build_object('ok',false,'reason','TARGET_MUST_BE_BELOW_CURRENT'); end if;
  v_reduce:=public.get_live_weight_reduction_scenario(p_symbol,p_target_pct);
  if not coalesce((v_reduce->>'ok')::boolean,false) then return v_reduce; end if;
  v_before:=(v_now->'position'->>'value')::numeric;
  v_exact:=(v_reduce->'scenario'->>'position_after_krw')::numeric;
  v_assets:=(v_now->'denominator'->>'value')::numeric;
  -- Match the single KB account selected by get_live_decision_metrics.
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live'
      and a.provider='kb_securities' and a.is_active
    order by a.created_at limit 1;
  select sum(b.quantity),case when count(distinct s.currency)=1 then max(s.currency) else null end,
    sum(h.market_value),sum(b.valuation_krw),count(*) filter(where h.market_value>0),count(*)
    into v_quantity,v_position_currency,v_native_total,v_native_krw_total,v_native_rows,v_holding_rows
    from public.live_holding_display_basis b
    join public.holdings h on h.account_id=b.account_id and h.security_id=b.security_id and h.as_of=b.as_of
    join public.accounts a on a.id=b.account_id join public.securities s on s.id=b.security_id
    where a.id=v_account and b.quantity>0 and s.symbol=upper(trim(p_symbol));
  v_case:=v_reduce->'scenario'->'share_quantity_case';
  v_integer:=v_case->>'status'='integer_shares_estimate' and
    v_quantity is not null and v_quantity=trunc(v_quantity) and v_before>0;
  if v_integer then
    v_sold:=(v_case->>'shares_to_sell')::numeric;
    if v_sold<0 or v_sold>v_quantity or v_sold<>trunc(v_sold) then
      v_integer:=false;
    end if;
  end if;
  -- Derive every displayed amount from the SAME whole-share count and
  -- current position valuation. Avoid mixing rounded broker and FX fields.
  if v_integer then v_after:=v_before*(v_quantity-v_sold)/v_quantity;
  else v_after:=v_exact; end if;
  -- Native proceeds come from the SAME broker holdings as the KRW valuation,
  -- using their local-market value and implied FX. No unfinished chart row or
  -- independently dated closing price is mixed into this comparison.
  if v_native_rows<>v_holding_rows or v_native_total is null or v_native_total<=0
     or v_native_krw_total is null or abs(v_native_krw_total-v_before)>1 then v_native_total:=null; end if;
  v_cash:=public.get_live_cash_accounting(null);
  if v_cash->'krw'->>'status'='confirmed_cash_balance' and
    (v_cash->'krw'->>'anchor_date')::date=
    ((v_now->>'observation_at')::timestamptz at time zone 'Asia/Seoul')::date then
    v_cash_value:=(v_cash->'krw'->>'balance')::numeric;
  end if;
  return jsonb_build_object('ok',true,'calculation_version','choice-comparison-v3',
    'observation_at',v_now->'observation_at','account_scope_state',v_now->'account_scope_state',
    'price_assumptions',jsonb_build_object('down_pct',p_down_pct,'up_pct',p_up_pct),
    'position_currency',v_position_currency,'denominator',v_now->'denominator','quantity',v_quantity,
    'basis','account-specific latest observations; no same-time claim',
    'current_cash_kb_krw',v_cash_value,
    'hold',jsonb_build_object('value_krw',v_before,'quantity',v_quantity,
      'weight_pct',v_before/v_assets*100,'cash_kb_krw',v_cash_value,
      'down_impact_krw',v_before*p_down_pct/100,'up_impact_krw',v_before*p_up_pct/100),
    'reduce',jsonb_build_object('value_krw',v_after,
      'quantity_reference',case when v_integer then v_quantity-v_sold
        when v_quantity is not null then v_quantity*v_after/v_before else null end,
      'shares_to_sell',case when v_integer then v_sold else null end,
      'mode',case when v_integer then 'integer_shares' else 'continuous_reference' end,
      'weight_pct',v_after/v_assets*100,
      'cash_increase_krw',v_before-v_after,
      'cash_native_estimate',case when v_position_currency<>'KRW' and v_integer and v_native_total is not null
        then v_native_total*v_sold/v_quantity else null end,
      'cash_native_basis',case when v_native_total is not null then 'kb_account_valuation' else null end,
      'cash_native_observation_at',v_now->'observation_at',
      'cash_native_fx_reference',case when v_native_total is not null then v_before/v_native_total else null end,
      'cash_kb_krw_reference',case when v_position_currency='KRW' and v_cash_value is not null
        then v_cash_value+v_before-v_after else null end,
      'down_impact_krw',v_after*p_down_pct/100,'up_impact_krw',v_after*p_up_pct/100,
      'share_quantity_case',v_case),
    'exact_target',jsonb_build_object('target_pct',p_target_pct,'value_krw',v_exact,
      'cash_increase_krw',v_before-v_exact,'down_impact_krw',v_exact*p_down_pct/100,
      'up_impact_krw',v_exact*p_up_pct/100),
    'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
    'assumptions','Same account scope and broker valuation for native and KRW proceeds; foreign sale proceeds stay in foreign cash; price and FX fixed; before fees/tax; not an order');
end $fn$;
revoke all on function public.get_live_choice_comparison(text,numeric,numeric,numeric) from public,anon;
grant execute on function public.get_live_choice_comparison(text,numeric,numeric,numeric) to authenticated;
