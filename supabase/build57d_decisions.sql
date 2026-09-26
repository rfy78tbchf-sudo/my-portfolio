-- Owner decisions are append-only. A plan to trade never changes the broker ledger.
alter table public.ai_analysis_history
  add column if not exists external_sources jsonb not null default '[]'::jsonb;
create table if not exists public.investment_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id uuid not null references public.securities(id),
  request_id uuid not null,
  choice text not null check (choice in ('hold','consider_reduction','pause_addition','revisit')),
  reason text not null check (length(reason) between 1 and 600),
  review_condition text not null check (length(review_condition) between 1 and 600),
  analysis_id uuid references public.ai_analysis_history(id),
  basis_at timestamptz,
  thesis_version integer,
  created_at timestamptz not null default now(),
  unique (user_id,request_id)
);
create index if not exists investment_decisions_recent
  on public.investment_decisions(user_id,security_id,created_at desc);
alter table public.investment_decisions enable row level security;
revoke all on public.investment_decisions from public,anon;
grant select,insert on public.investment_decisions to authenticated;
create policy investment_decisions_owner_select on public.investment_decisions
  for select to authenticated using (user_id=(select auth.uid()));
create policy investment_decisions_owner_insert on public.investment_decisions
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.holdings h join public.accounts a on a.id=h.account_id
      where h.security_id=investment_decisions.security_id and h.quantity>0
        and a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    ) and (analysis_id is null or exists (
      select 1 from public.ai_analysis_history ai join public.securities s on s.id=investment_decisions.security_id
      where ai.id=investment_decisions.analysis_id and ai.user_id=(select auth.uid())
        and ai.symbol=s.symbol
    ))
  );

create or replace function public.save_investment_decision(
  p_security_id uuid,p_choice text,p_reason text,p_review_condition text,
  p_analysis_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_user uuid:=(select auth.uid()); v_symbol text; v_history public.ai_analysis_history%rowtype;
declare v_basis timestamptz; v_version integer; v_row public.investment_decisions%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_choice not in ('hold','consider_reduction','pause_addition','revisit')
    or length(trim(coalesce(p_reason,''))) not between 1 and 600
    or length(trim(coalesce(p_review_condition,''))) not between 1 and 600 then
    raise exception 'invalid decision fields'; end if;
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
  else
    select max(h.as_of) into v_basis from public.holdings h
    join public.accounts a on a.id=h.account_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and h.security_id=p_security_id;
    select t.version into v_version from public.investment_theses t
    where t.user_id=v_user and t.security_id=p_security_id;
  end if;
  insert into public.investment_decisions(user_id,security_id,request_id,choice,reason,
    review_condition,analysis_id,basis_at,thesis_version)
  values(v_user,p_security_id,p_request_id,p_choice,trim(p_reason),
    trim(p_review_condition),p_analysis_id,v_basis,v_version)
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
    d.thesis_version,d.analysis_id from public.investment_decisions d
    where d.user_id=(select auth.uid()) and d.security_id=p_security_id
    order by d.created_at desc limit 10) q;
$fn$;
revoke all on function public.get_investment_decisions(uuid) from public,anon;
grant execute on function public.get_investment_decisions(uuid) to authenticated;

-- Combine existing, owner-scoped server calculations under one observation.
create or replace function public.get_live_choice_comparison(
  p_symbol text,p_target_pct numeric,p_down_pct numeric default -10,p_up_pct numeric default 10)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_now jsonb; v_reduce jsonb; v_cash jsonb;
declare v_before numeric; v_after numeric; v_assets numeric; v_quantity numeric;
declare v_cash_value numeric;
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
  v_cash:=public.get_live_cash_accounting(null);
  if v_cash->'krw'->>'status'='confirmed_cash_balance' and
    (v_cash->'krw'->>'anchor_date')::date=
    ((v_now->>'observation_at')::timestamptz at time zone 'Asia/Seoul')::date then
    v_cash_value:=(v_cash->'krw'->>'balance')::numeric;
  end if;
  return jsonb_build_object('ok',true,'calculation_version','choice-comparison-v1',
    'observation_at',v_now->'observation_at','account_scope_state',v_now->'account_scope_state',
    'price_assumptions',jsonb_build_object('down_pct',p_down_pct,'up_pct',p_up_pct),
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
