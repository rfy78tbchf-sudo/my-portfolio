-- The selected scenario uses a whole-share sale when quantity and unit
-- valuation are available. Keep the exact target as a separate reference.
create or replace function public.get_live_choice_comparison(
  p_symbol text,p_target_pct numeric,p_down_pct numeric default -10,p_up_pct numeric default 10)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_now jsonb; v_reduce jsonb; v_cash jsonb; v_case jsonb;
declare v_before numeric; v_exact numeric; v_after numeric; v_assets numeric; v_quantity numeric;
declare v_sold numeric; v_cash_value numeric; v_position_currency text; v_integer boolean;
declare v_native_close numeric; v_native_date date;
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
  select sum(h.quantity),case when count(distinct s.currency)=1 then max(s.currency) else null end
    into v_quantity,v_position_currency from public.live_holding_display_basis h
    join public.accounts a on a.id=h.account_id join public.securities s on s.id=h.security_id
    where a.user_id=(select auth.uid()) and a.provider='kb_securities'
      and a.mode='live' and a.is_active and h.quantity>0 and s.symbol=upper(trim(p_symbol));
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
  if v_position_currency<>'KRW' and v_integer then
    select p.close,p.price_date into v_native_close,v_native_date
    from public.daily_security_prices p join public.securities s on s.id=p.security_id
    where s.symbol=upper(trim(p_symbol)) and p.currency=v_position_currency and p.close>0
    order by p.price_date desc,p.observed_at desc limit 1;
  end if;
  v_cash:=public.get_live_cash_accounting(null);
  if v_cash->'krw'->>'status'='confirmed_cash_balance' and
    (v_cash->'krw'->>'anchor_date')::date=
    ((v_now->>'observation_at')::timestamptz at time zone 'Asia/Seoul')::date then
    v_cash_value:=(v_cash->'krw'->>'balance')::numeric;
  end if;
  return jsonb_build_object('ok',true,'calculation_version','choice-comparison-v2',
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
      'cash_native_estimate',case when v_native_close is not null then v_native_close*v_sold else null end,
      'cash_native_price_date',v_native_date,
      'cash_kb_krw_reference',case when v_position_currency='KRW' and v_cash_value is not null
        then v_cash_value+v_before-v_after else null end,
      'down_impact_krw',v_after*p_down_pct/100,'up_impact_krw',v_after*p_up_pct/100,
      'share_quantity_case',v_case),
    'exact_target',jsonb_build_object('target_pct',p_target_pct,'value_krw',v_exact,
      'cash_increase_krw',v_before-v_exact,'down_impact_krw',v_exact*p_down_pct/100,
      'up_impact_krw',v_exact*p_up_pct/100),
    'assets_before_krw',v_assets,'assets_after_before_cost_krw',v_assets,
    'assumptions','Same account scope; average KRW valuation per share; foreign sale proceeds stay in foreign cash; prices and FX fixed; before fees/tax; not an order');
end $fn$;
revoke all on function public.get_live_choice_comparison(text,numeric,numeric,numeric) from public,anon;
grant execute on function public.get_live_choice_comparison(text,numeric,numeric,numeric) to authenticated;

-- Reject a changed scenario or thesis, but allow a same-value refresh to
-- replace an observation timestamp. The six-argument save enforces analysis
-- ownership, security, thesis version and account values.
alter table public.ai_analysis_history
  add column if not exists comparison_evidence jsonb;
create or replace function public.save_investment_decision(
  p_security_id uuid,p_choice text,p_reason text,p_review_condition text,
  p_analysis_id uuid,p_request_id uuid,p_target_pct numeric,
  p_down_pct numeric,p_up_pct numeric,p_observation_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_comparison jsonb;
declare v_saved jsonb; v_existing public.investment_decisions%rowtype;
declare v_history public.ai_analysis_history%rowtype;
declare v_rule_created timestamptz; v_price_date date; v_close numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_target_pct is null or p_observation_at is null or p_analysis_id is null then
    raise exception 'analysis and comparison required'; end if;
  select * into v_existing from public.investment_decisions
    where user_id=v_user and request_id=p_request_id;
  if found then
    if v_existing.security_id is distinct from p_security_id or v_existing.choice is distinct from p_choice
      or v_existing.analysis_id is distinct from p_analysis_id
      or (v_existing.scenario_snapshot->'choice_comparison'->>'target_pct')::numeric is distinct from p_target_pct
      or (v_existing.scenario_snapshot->'choice_comparison'->'price_assumptions'->>'down_pct')::numeric is distinct from p_down_pct
      or (v_existing.scenario_snapshot->'choice_comparison'->'price_assumptions'->>'up_pct')::numeric is distinct from p_up_pct
      or v_existing.reason is distinct from trim(p_reason) or
      v_existing.review_condition is distinct from trim(p_review_condition) then
      raise exception 'request ID reused'; end if;
    return jsonb_build_object('ok',true,'id',v_existing.id,'choice',v_existing.choice,
      'created_at',v_existing.created_at,'basis_at',v_existing.basis_at,
      'thesis_version',v_existing.thesis_version,'analysis_id',v_existing.analysis_id);
  end if;
  select s.symbol into v_symbol from public.securities s where s.id=p_security_id
    and exists(select 1 from public.holdings h join public.accounts a on a.id=h.account_id
      where h.security_id=s.id and h.quantity>0 and a.user_id=v_user
        and a.provider='kb_securities' and a.mode='live' and a.is_active);
  if v_symbol is null then raise exception 'held security not found'; end if;
  select * into v_history from public.ai_analysis_history
    where id=p_analysis_id and user_id=v_user and symbol=v_symbol;
  if not found or v_history.account_basis is null or v_history.comparison_evidence is null then
    raise exception 'fresh analysis with this comparison required'; end if;
  select max(r.created_at) into v_rule_created from public.investment_breakout_rules r
    where r.user_id=v_user and r.security_id=p_security_id;
  if v_rule_created is distinct from
    (v_history.price_evidence->'approved_rule'->>'confirmed_at')::timestamptz then
    raise exception 'breakout condition changed; refresh analysis'; end if;
  if v_history.price_evidence->>'price_date' is not null then
    select p.price_date,p.close into v_price_date,v_close from public.daily_security_prices p
      where p.security_id=p_security_id order by p.price_date desc,p.observed_at desc limit 1;
    if v_price_date is distinct from (v_history.price_evidence->>'price_date')::date or
      v_close is distinct from (v_history.price_evidence->>'latest_close')::numeric then
      raise exception 'price evidence changed; refresh analysis'; end if;
  end if;
  v_comparison:=public.get_live_choice_comparison(v_symbol,p_target_pct,p_down_pct,p_up_pct);
  if not coalesce((v_comparison->>'ok')::boolean,false) then
    raise exception 'comparison unavailable; recalculate'; end if;
  if (v_history.account_basis->>'position_value_krw')::numeric is distinct from
       (v_comparison->'hold'->>'value_krw')::numeric
     or (v_history.account_basis->>'denominator_value_krw')::numeric is distinct from
       (v_comparison->'denominator'->>'value')::numeric
     or (v_history.account_basis->>'quantity')::numeric is distinct from
       (v_comparison->'hold'->>'quantity')::numeric
     or (v_history.comparison_evidence->>'target_pct')::numeric is distinct from p_target_pct
     or v_history.comparison_evidence->'price_assumptions' is distinct from v_comparison->'price_assumptions'
     or (v_history.comparison_evidence->'reduce'->>'shares_to_sell')::numeric is distinct from
       (v_comparison->'reduce'->>'shares_to_sell')::numeric
     or (v_history.comparison_evidence->'reduce'->>'cash_increase_krw')::numeric is distinct from
       (v_comparison->'reduce'->>'cash_increase_krw')::numeric
     or (v_comparison->'reduce'->>'mode') is distinct from 'integer_shares' then
    raise exception 'account values changed; refresh analysis and comparison'; end if;
  -- All submitted comparison inputs are checked. Analysis account values
  -- guard subsequent balance changes independently of the timestamp.
  v_saved:=public.save_investment_decision(p_security_id,p_choice,p_reason,
    p_review_condition,p_analysis_id,p_request_id);
  update public.investment_decisions d set scenario_snapshot=d.scenario_snapshot ||
    jsonb_build_object('choice_comparison',jsonb_build_object(
      'target_pct',p_target_pct,'price_assumptions',v_comparison->'price_assumptions',
      'hold',v_comparison->'hold','reduce',v_comparison->'reduce',
      'exact_target',v_comparison->'exact_target',
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

-- A breakout definition is an explicit, dated user choice. Earlier choices
-- remain available and no reference rule is silently promoted into one.
create table if not exists public.investment_breakout_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id uuid not null references public.securities(id),
  kind text not null check (kind in ('prior_20_close','price_close')),
  threshold numeric check (threshold>0),
  currency text not null,
  event_date date,
  created_at timestamptz not null default now(),
  check ((kind='price_close' and threshold is not null) or
         (kind='prior_20_close' and threshold is null))
);
create index if not exists investment_breakout_rules_latest
  on public.investment_breakout_rules (user_id,security_id,created_at desc);
alter table public.investment_breakout_rules enable row level security;
revoke all on public.investment_breakout_rules from public,anon,authenticated;
grant select on public.investment_breakout_rules to authenticated;
create policy investment_breakout_rules_owner_read on public.investment_breakout_rules
  for select to authenticated using (user_id=(select auth.uid()));
create or replace function public.save_investment_breakout_rule(
  p_security_id uuid,p_kind text,p_threshold numeric default null,p_event_date date default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_currency text; v_row public.investment_breakout_rules%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if (p_kind='price_close' and (p_threshold is null or p_threshold<=0 or p_threshold>100000000))
    or (p_kind='prior_20_close' and p_threshold is not null)
    or p_kind not in ('price_close','prior_20_close')
    or p_kind is null or p_event_date>current_date then
    raise exception 'invalid breakout definition'; end if;
  select s.currency into v_currency from public.securities s
    where s.id=p_security_id and exists(select 1 from public.holdings h
      join public.accounts a on a.id=h.account_id
      where a.user_id=v_user and a.mode='live' and a.is_active
        and h.security_id=s.id and h.quantity>0);
  if v_currency is null then raise exception 'held security not found'; end if;
  insert into public.investment_breakout_rules(user_id,security_id,kind,threshold,currency,event_date)
    values(v_user,p_security_id,p_kind,p_threshold,v_currency,p_event_date)
    returning * into v_row;
  return jsonb_build_object('ok',true,'id',v_row.id,'created_at',v_row.created_at);
end $fn$;
revoke all on function public.save_investment_breakout_rule(uuid,text,numeric,date) from public,anon;
grant execute on function public.save_investment_breakout_rule(uuid,text,numeric,date) to authenticated;
