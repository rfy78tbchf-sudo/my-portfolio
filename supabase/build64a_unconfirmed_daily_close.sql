-- A broker chart may supply a date and an indicative price before the regular
-- session has ended. It is not a confirmed daily close. Archive already saved
-- rows at their original observation time; do not rewrite historical prices.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.last_completed_close_date(
  p_market text, p_observed_at timestamptz)
returns date language sql stable security invoker set search_path='' as $fn$
  select case
    when p_market='KRX' then
      (least(coalesce(p_observed_at,now()),now()) at time zone 'Asia/Seoul')::date -
      case when (least(coalesce(p_observed_at,now()),now()) at time zone 'Asia/Seoul')::time < time '15:45'
        then 1 else 0 end
    when p_market in ('NAS','NYS','AMX') then
      (least(coalesce(p_observed_at,now()),now()) at time zone 'America/New_York')::date -
      case when (least(coalesce(p_observed_at,now()),now()) at time zone 'America/New_York')::time < time '16:15'
        then 1 else 0 end
    else null::date end
$fn$;
revoke all on function app_private.last_completed_close_date(text,timestamptz) from public,anon,authenticated;

create table if not exists app_private.unconfirmed_daily_closes (
  original_id uuid primary key,
  original_row jsonb not null,
  reason text not null,
  archived_at timestamptz not null default now()
);
alter table app_private.unconfirmed_daily_closes enable row level security;
revoke all on app_private.unconfirmed_daily_closes from public,anon,authenticated;

create or replace function public.upsert_daily_security_prices_for_service(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $fn$
declare v_count integer:=0;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then return 0; end if;
  insert into public.daily_security_prices(
    security_id,price_date,open,high,low,close,volume,currency,source,observed_at
  )
  select
    s.id,(x->>'price_date')::date,
    nullif(x->>'open','')::numeric,
    nullif(x->>'high','')::numeric,
    nullif(x->>'low','')::numeric,
    nullif(x->>'close','')::numeric,
    nullif(x->>'volume','')::numeric,
    coalesce(nullif(x->>'currency',''),'KRW'),
    coalesce(nullif(x->>'source',''),'kb_openapi'),
    obs.as_of
  from jsonb_array_elements(p_rows) x
    join public.securities s on s.id=(x->>'security_id')::uuid
    cross join lateral (select least(coalesce(nullif(x->>'observed_at','')::timestamptz,now()),now()) as as_of) obs
  where nullif(x->>'security_id','') is not null
    and nullif(x->>'price_date','') is not null
    and nullif(x->>'close','') is not null
    and extract(isodow from (x->>'price_date')::date) between 1 and 5
    and (x->>'price_date')::date <= app_private.last_completed_close_date(s.market,obs.as_of)
  on conflict(security_id,price_date,source) do update set
    open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close,
    volume=excluded.volume, currency=excluded.currency, observed_at=excluded.observed_at;
  get diagnostics v_count=row_count;
  return v_count;
end $fn$;
revoke all on function public.upsert_daily_security_prices_for_service(jsonb) from public,anon,authenticated;
grant execute on function public.upsert_daily_security_prices_for_service(jsonb) to service_role;

insert into app_private.unconfirmed_daily_closes(original_id,original_row,reason)
select p.id,to_jsonb(p),'market day unfinished at original observation'
from public.daily_security_prices p join public.securities s on s.id=p.security_id
where p.source='kb_openapi' and s.market in ('KRX','NAS','NYS','AMX')
  and (extract(isodow from p.price_date) not between 1 and 5
       or p.price_date>app_private.last_completed_close_date(s.market,p.observed_at))
on conflict(original_id) do nothing;

-- Keep the original generated opinions and numbers; attach a correction so
-- neither a cached response nor a past answer is misrepresented as reliable.
update public.ai_analysis_history a set price_evidence=a.price_evidence ||
  jsonb_build_object('review_status','unconfirmed_market_close',
    'review_note','분석 당시 해당 시장의 종가가 확정되지 않았습니다. 최신 자료로 다시 점검해 주세요.',
    'review_marked_at',now())
where a.price_evidence->>'price_date' is not null
  and coalesce(a.price_evidence->>'review_status','')<>'unconfirmed_market_close'
  and exists (
    select 1 from app_private.unconfirmed_daily_closes q
      join public.securities s on s.id=(q.original_row->>'security_id')::uuid
    where s.symbol=a.symbol and q.original_row->>'price_date'=a.price_evidence->>'price_date'
      and a.created_at < case when s.market='KRX' then
          ((q.original_row->>'price_date')::date + time '15:45') at time zone 'Asia/Seoul'
        else ((q.original_row->>'price_date')::date + time '16:15') at time zone 'America/New_York'
        end
  );

delete from public.daily_security_prices p using app_private.unconfirmed_daily_closes q
where p.id=q.original_id and to_jsonb(p)=q.original_row;

-- A previously saved response with an unconfirmed close cannot anchor a new
-- judgment, including a simple hold without a target-weight comparison.
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
    if v_history.price_evidence->>'review_status'='unconfirmed_market_close' then
      raise exception 'analysis used an unconfirmed close; refresh analysis'; end if;
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
