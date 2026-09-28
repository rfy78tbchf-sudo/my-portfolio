-- Build 65: atomic, owner-scoped decision save and security-scoped reread.
-- The existing six-argument append-only save handles comparison-free decisions.
CREATE OR REPLACE FUNCTION public.save_investment_decision(p_security_id uuid, p_choice text, p_reason text, p_review_condition text, p_analysis_id uuid, p_request_id uuid, p_target_pct numeric, p_down_pct numeric, p_up_pct numeric, p_observation_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_comparison jsonb;
declare v_saved jsonb; v_existing public.investment_decisions%rowtype;
declare v_history public.ai_analysis_history%rowtype;
declare v_rule_created timestamptz; v_price_date date; v_close numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  -- Require complete comparison inputs. Hold, pause and revisit may omit all four.
  if p_target_pct is null then
    if p_down_pct is not null or p_up_pct is not null or p_observation_at is not null
      or p_choice='consider_reduction' then raise exception 'complete comparison required'; end if;
    if exists(select 1 from public.investment_decisions d
      where d.user_id=v_user and d.request_id=p_request_id
        and d.scenario_snapshot ? 'choice_comparison') then
      raise exception 'request ID reused'; end if;
    return public.save_investment_decision(p_security_id,p_choice,p_reason,
      p_review_condition,p_analysis_id,p_request_id);
  end if;
  if p_observation_at is null or p_analysis_id is null or p_down_pct is null or p_up_pct is null then
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
end $function$;
revoke all on function public.save_investment_decision(uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz) from public,anon;
grant execute on function public.save_investment_decision(uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz) to authenticated;

create or replace function public.get_investment_decisions(p_security_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
  from (select d.id,d.security_id,d.choice,d.reason,d.review_condition,d.created_at,d.basis_at,
    d.thesis_version,d.analysis_id,d.official_evidence_snapshot,d.price_snapshot,
    d.account_snapshot,d.scenario_snapshot from public.investment_decisions d
    where d.user_id=(select auth.uid()) and d.security_id=p_security_id
    order by d.created_at desc limit 10) q;
$fn$;
revoke all on function public.get_investment_decisions(uuid) from public,anon;
grant execute on function public.get_investment_decisions(uuid) to authenticated;
