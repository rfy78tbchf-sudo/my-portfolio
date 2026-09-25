-- Read-only production smoke test. Run as an operator; no account rows are changed.
do $test$
declare v_user uuid; v_account uuid; v_today jsonb; v_month jsonb;
  v_movements jsonb; v_cases integer; v_rows integer;
begin
  select id,user_id into v_account,v_user from public.accounts
  where mode='live' and is_active order by created_at limit 1;
  if v_account is null then raise exception 'Live account missing'; end if;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_today:=public.get_live_reliable_performance('오늘');
  v_month:=public.get_live_reliable_performance('1M');
  if not coalesce((v_today->>'ok')::boolean,false) or
     not coalesce((v_month->>'ok')::boolean,false) then
    raise exception 'Period gate did not return a valid response'; end if;
  if v_today->>'state'<>'unavailable' then
    if abs(((v_today->>'closing_assets')::numeric-
       (v_today->>'opening_assets')::numeric-
       (v_today->>'external_flow')::numeric)-
       (v_today->>'investment_pnl')::numeric)>1 then
      raise exception 'External cash flow leaked into daily investment P&L'; end if;
    if (v_today->>'external_flow')::numeric<>0 and
       v_today->'twr_pct' is distinct from 'null'::jsonb then
      raise exception 'Intraday flow was incorrectly labelled as confirmed TWR'; end if;
    if v_today->>'state'='confirmed' and (v_today->>'cash_gap_intervals')::int<>0 then
      raise exception 'Cash mismatch passed the confirmed gate'; end if;
  end if;
  if v_month->>'state'<>'unavailable' and
      (v_month->>'reliable_start')::date>(v_month->>'requested_start')::date
      and not (v_month->>'partial')::boolean then
    raise exception 'Partial observed window was presented as full month'; end if;
  v_movements:=public.get_live_verified_position_movements('오늘');
  if (v_movements->>'attribution_complete')::boolean is true then
    raise exception 'Incomplete position movements presented as full attribution'; end if;
  select count(*) into v_cases from public.live_cash_case_assessments
  where account_id=v_account;
  select count(*) into v_rows from public.daily_performance_evidence
  where account_id=v_account;
  raise notice 'Verified % observed intervals, % cash cases; live today %, month %',
    v_rows,v_cases,v_today->>'state',v_month->>'state';
end $test$;
