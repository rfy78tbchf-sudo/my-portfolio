-- Bind a saved judgment to the current thesis and account observation.
-- Existing judgments are append-only and unchanged.
alter table public.ai_analysis_history add column if not exists account_basis jsonb;
create or replace function public.save_investment_decision(
  p_security_id uuid,p_choice text,p_reason text,p_review_condition text,
  p_analysis_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_history public.ai_analysis_history%rowtype;
declare v_basis timestamptz; v_version integer; v_row public.investment_decisions%rowtype;
declare v_metric jsonb; v_account jsonb:='{}'::jsonb; v_scenario jsonb:='{}'::jsonb;
declare v_price jsonb:='{}'::jsonb; v_official jsonb:='{}'::jsonb; v_current_version integer;
declare v_current_basis jsonb; v_quantity numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_choice not in ('hold','consider_reduction','pause_addition','revisit')
    or length(trim(coalesce(p_reason,''))) not between 1 and 600
    or length(trim(coalesce(p_review_condition,''))) not between 1 and 600 then
    raise exception 'invalid decision fields'; end if;
  select * into v_row from public.investment_decisions
    where user_id=v_user and request_id=p_request_id;
  if found then
    if v_row.security_id is distinct from p_security_id or v_row.choice is distinct from p_choice
      or v_row.reason is distinct from trim(p_reason) or v_row.review_condition is distinct from trim(p_review_condition)
      or v_row.analysis_id is distinct from p_analysis_id then raise exception 'request ID reused'; end if;
    return jsonb_build_object('ok',true,'id',v_row.id,'choice',v_row.choice,
      'created_at',v_row.created_at,'basis_at',v_row.basis_at,
      'thesis_version',v_row.thesis_version,'analysis_id',v_row.analysis_id);
  end if;
  select s.symbol into v_symbol from public.securities s
  where s.id=p_security_id and exists (
    select 1 from public.holdings h join public.accounts a on a.id=h.account_id
    where h.security_id=s.id and h.quantity>0 and a.user_id=v_user
      and a.mode='live' and a.is_active);
  if v_symbol is null then raise exception 'held security not found'; end if;
  if p_analysis_id is not null then
    select * into v_history from public.ai_analysis_history ai
      where ai.id=p_analysis_id and ai.user_id=v_user and ai.symbol=v_symbol;
    if not found then raise exception 'analysis does not belong to this security'; end if;
    v_basis:=v_history.observation_at; v_version:=v_history.thesis_version;
    v_official:=v_history.official_evidence; v_price:=v_history.price_evidence;
  else
    select max(h.as_of) into v_basis from public.holdings h
    join public.accounts a on a.id=h.account_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and h.security_id=p_security_id;
    select t.version into v_version from public.investment_theses t
      where t.user_id=v_user and t.security_id=p_security_id;
  end if;
  -- These server calculations are observations and +/-10% assumptions, never
  -- executed trades or the user's chosen target weight.
  v_metric:=public.get_live_decision_metrics(v_symbol,0);
  if p_analysis_id is not null then
    select t.version into v_current_version from public.investment_theses t
      where t.user_id=v_user and t.security_id=p_security_id;
    if v_history.thesis_version is distinct from v_current_version then
      raise exception 'holding reason changed; refresh analysis';
    end if;
    if not coalesce((v_metric->>'ok')::boolean,false) then
      raise exception 'account observation changed; refresh analysis';
    end if;
    if v_history.account_basis is not null then
      select sum(h.quantity) into v_quantity from public.live_holding_display_basis h
      join public.accounts a on a.id=h.account_id
      join public.securities s on s.id=h.security_id
      where a.user_id=v_user and a.provider='kb_securities' and a.mode='live'
        and a.is_active and h.quantity>0 and s.id=p_security_id;
      v_current_basis:=jsonb_build_object('symbol',v_metric->'position'->'symbol',
        'position_value_krw',v_metric->'position'->'value',
        'denominator_value_krw',v_metric->'denominator'->'value',
        'kb_response_value',v_metric->'denominator'->'kb_response_value',
        'isa_total_value',v_metric->'denominator'->'manual_overlay',
        'scope_state',v_metric->'account_scope_state','quantity',v_quantity);
      if v_history.account_basis is distinct from v_current_basis then
        raise exception 'account values changed; refresh analysis and comparison';
      end if;
    elsif v_history.observation_at is null or
      v_history.observation_at is distinct from (v_metric->>'observation_at')::timestamptz then
      raise exception 'account observation changed; refresh analysis';
    end if;
  end if;
  if coalesce((v_metric->>'ok')::boolean,false) then
    v_account:=jsonb_build_object('observation_at',v_metric->'observation_at',
      'position',v_metric->'position','denominator',v_metric->'denominator',
      'account_scope_state',v_metric->'account_scope_state');
    v_scenario:=jsonb_build_object('assumptions','other assets and FX fixed; no execution or cost',
      'minus_ten_krw',(v_metric->'position'->>'value')::numeric* -0.1,
      'plus_ten_krw',(v_metric->'position'->>'value')::numeric* 0.1);
  end if;
  if v_price='{}'::jsonb then
    select jsonb_build_object('price_date',p.price_date,'close',p.close,
      'currency',p.currency,'source',p.source,'observed_at',p.observed_at)
      into v_price from public.daily_security_prices p
    where p.security_id=p_security_id order by p.price_date desc,p.observed_at desc limit 1;
  end if;
  insert into public.investment_decisions(user_id,security_id,request_id,choice,reason,
    review_condition,analysis_id,basis_at,thesis_version,official_evidence_snapshot,
    price_snapshot,account_snapshot,scenario_snapshot)
  values(v_user,p_security_id,p_request_id,p_choice,trim(p_reason),
    trim(p_review_condition),p_analysis_id,v_basis,v_version,coalesce(v_official,'{}'::jsonb),
    coalesce(v_price,'{}'::jsonb),v_account,v_scenario)
  on conflict(user_id,request_id) do nothing;
  select * into v_row from public.investment_decisions
    where user_id=v_user and request_id=p_request_id;
  if v_row.security_id is distinct from p_security_id or v_row.choice is distinct from p_choice
      or v_row.reason is distinct from trim(p_reason) or v_row.review_condition is distinct from trim(p_review_condition)
      or v_row.analysis_id is distinct from p_analysis_id then raise exception 'request ID reused'; end if;
  return jsonb_build_object('ok',true,'id',v_row.id,'choice',v_row.choice,
    'created_at',v_row.created_at,'basis_at',v_row.basis_at,
    'thesis_version',v_row.thesis_version,'analysis_id',v_row.analysis_id);
end $fn$;
revoke all on function public.save_investment_decision(uuid,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.save_investment_decision(uuid,text,text,text,uuid,uuid) to authenticated;


create or replace function public.save_investment_decision(
  p_security_id uuid,p_choice text,p_reason text,p_review_condition text,
  p_analysis_id uuid,p_request_id uuid,p_target_pct numeric,
  p_down_pct numeric,p_up_pct numeric,p_observation_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_comparison jsonb;
declare v_saved jsonb; v_existing public.investment_decisions%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_target_pct is null or p_observation_at is null then raise exception 'comparison required'; end if;
  select * into v_existing from public.investment_decisions
    where user_id=v_user and request_id=p_request_id;
  if found then
    if v_existing.security_id is distinct from p_security_id or v_existing.choice is distinct from p_choice
      or v_existing.analysis_id is distinct from p_analysis_id
      or (v_existing.scenario_snapshot->'choice_comparison'->>'target_pct')::numeric is distinct from p_target_pct
      or (v_existing.scenario_snapshot->'choice_comparison'->'price_assumptions'->>'down_pct')::numeric is distinct from p_down_pct
      or (v_existing.scenario_snapshot->'choice_comparison'->'price_assumptions'->>'up_pct')::numeric is distinct from p_up_pct
      or (v_existing.scenario_snapshot->'choice_comparison'->>'observation_at')::timestamptz is distinct from p_observation_at
      or v_existing.reason is distinct from trim(p_reason) or
      v_existing.review_condition is distinct from trim(p_review_condition) then
      raise exception 'request ID reused';
    end if;
    return jsonb_build_object('ok',true,'id',v_existing.id,'choice',v_existing.choice,
      'created_at',v_existing.created_at,'basis_at',v_existing.basis_at,
      'thesis_version',v_existing.thesis_version,'analysis_id',v_existing.analysis_id);
  end if;
  select s.symbol into v_symbol from public.securities s where s.id=p_security_id
    and exists(select 1 from public.holdings h join public.accounts a on a.id=h.account_id
      where h.security_id=s.id and h.quantity>0 and a.user_id=v_user
        and a.provider='kb_securities' and a.mode='live' and a.is_active);
  if v_symbol is null then raise exception 'held security not found'; end if;
  -- Recalculate within this authenticated request. A stale UI comparison
  -- must not be silently saved as if it were the current position.
  v_comparison:=public.get_live_choice_comparison(v_symbol,p_target_pct,p_down_pct,p_up_pct);
  if not coalesce((v_comparison->>'ok')::boolean,false) or
    (v_comparison->>'observation_at')::timestamptz is distinct from p_observation_at then
    raise exception 'comparison observation changed; recalculate';
  end if;
  v_saved:=public.save_investment_decision(p_security_id,p_choice,p_reason,
    p_review_condition,p_analysis_id,p_request_id);
  update public.investment_decisions d set scenario_snapshot=d.scenario_snapshot ||
    jsonb_build_object('choice_comparison',jsonb_build_object(
      'target_pct',p_target_pct,'price_assumptions',v_comparison->'price_assumptions',
      'hold',v_comparison->'hold','reduce',v_comparison->'reduce',
      'assets_before_krw',v_comparison->'assets_before_krw',
      'assets_after_before_cost_krw',v_comparison->'assets_after_before_cost_krw',
      'observation_at',v_comparison->'observation_at',
      'calculation_version',v_comparison->'calculation_version'))
    where d.id=(v_saved->>'id')::uuid and d.user_id=v_user;
  if not found then raise exception 'decision comparison was not stored'; end if;
  return v_saved;
end $fn$;
revoke all on function public.save_investment_decision(uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz) from public,anon;
grant execute on function public.save_investment_decision(uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz) to authenticated;

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
      'cash_kb_krw_reference',case when v_cash_value is not null
        then v_cash_value+(v_reduce->'scenario'->>'cash_increase_before_cost_krw')::numeric else null end,
      'down_impact_krw',v_after*p_down_pct/100,'up_impact_krw',v_after*p_up_pct/100,
      'share_quantity_case',v_reduce->'scenario'->'share_quantity_case'),
    'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
    'assumptions','Position KRW valuation changes, other assets and FX fixed; continuous target share reference; sell proceeds held as cash before fees and tax; no order or forecast');
end $fn$;

revoke all on function public.get_live_choice_comparison(text,numeric,numeric,numeric) from public,anon;
grant execute on function public.get_live_choice_comparison(text,numeric,numeric,numeric) to authenticated;
