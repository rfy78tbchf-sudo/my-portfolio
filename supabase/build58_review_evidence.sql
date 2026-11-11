-- Preserve the evidence available when an owner records a decision. Existing
-- rows keep empty snapshots and cannot be retroactively credited with sources.
alter table public.ai_analysis_history
  add column if not exists official_evidence jsonb not null default '{}'::jsonb,
  add column if not exists price_evidence jsonb not null default '{}'::jsonb;
alter table public.investment_decisions
  add column if not exists official_evidence_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists price_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists account_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists scenario_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.save_investment_decision(
  p_security_id uuid,p_choice text,p_reason text,p_review_condition text,
  p_analysis_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_history public.ai_analysis_history%rowtype;
declare v_basis timestamptz; v_version integer; v_row public.investment_decisions%rowtype;
declare v_metric jsonb; v_account jsonb:='{}'::jsonb; v_scenario jsonb:='{}'::jsonb;
declare v_price jsonb:='{}'::jsonb; v_official jsonb:='{}'::jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_choice not in ('hold','consider_reduction','pause_addition','revisit')
    or length(trim(coalesce(p_reason,''))) not between 1 and 600
    or length(trim(coalesce(p_review_condition,''))) not between 1 and 600 then
    raise exception 'invalid decision fields'; end if;
  select * into v_row from public.investment_decisions
    where user_id=v_user and request_id=p_request_id;
  if found then
    if v_row.security_id is distinct from p_security_id then raise exception 'request ID reused'; end if;
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
  if v_row.security_id is distinct from p_security_id then raise exception 'request ID reused'; end if;
  return jsonb_build_object('ok',true,'id',v_row.id,'choice',v_row.choice,
    'created_at',v_row.created_at,'basis_at',v_row.basis_at,
    'thesis_version',v_row.thesis_version,'analysis_id',v_row.analysis_id);
end $fn$;
revoke all on function public.save_investment_decision(uuid,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.save_investment_decision(uuid,text,text,text,uuid,uuid) to authenticated;

create or replace function public.get_investment_decisions(p_security_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
  from (select d.id,d.choice,d.reason,d.review_condition,d.created_at,d.basis_at,
    d.thesis_version,d.analysis_id,d.official_evidence_snapshot,d.price_snapshot,
    d.account_snapshot,d.scenario_snapshot from public.investment_decisions d
    where d.user_id=(select auth.uid()) and d.security_id=p_security_id
    order by d.created_at desc limit 10) q;
$fn$;
revoke all on function public.get_investment_decisions(uuid) from public,anon;
grant execute on function public.get_investment_decisions(uuid) to authenticated;
