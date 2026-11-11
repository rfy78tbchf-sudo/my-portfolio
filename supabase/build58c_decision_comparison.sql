-- Preserve the user's selected, server-recalculated comparison beside the
-- existing append-only judgment. Old six-argument calls remain supported.
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
