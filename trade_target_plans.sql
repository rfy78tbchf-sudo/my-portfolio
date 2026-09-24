-- Store a small, user-owned list of scenario prices. These are arithmetic
-- targets, not orders or a claim that two different securities track exactly.
create or replace function public.save_trade_target_plans(p_plans jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_plan jsonb;
  v_id uuid;
  v_number numeric;
  v_key text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_plans is null or jsonb_typeof(p_plans) <> 'array'
    or jsonb_array_length(p_plans)>12 then raise exception 'invalid trade target list'; end if;
  for v_plan in select value from jsonb_array_elements(p_plans) loop
    if jsonb_typeof(v_plan)<>'object'
      or coalesce(v_plan->>'id','') !~ '^[0-9a-f-]{36}$'
      or coalesce(v_plan->>'side','') not in ('buy','sell')
      or coalesce(v_plan->>'trigger_security_id','') !~* '^[0-9a-f-]{36}$'
      or coalesce(v_plan->>'trade_security_id','') !~* '^[0-9a-f-]{36}$'
      then raise exception 'invalid trade target'; end if;
    v_id := (v_plan->>'trigger_security_id')::uuid;
    if not exists(select 1 from public.securities where id=v_id) then
      raise exception 'unknown trigger security'; end if;
    v_id := (v_plan->>'trade_security_id')::uuid;
    if not exists(select 1 from public.securities where id=v_id) then
      raise exception 'unknown trade security'; end if;
    foreach v_key in array array['trigger_base','trade_base','trigger_pct','trade_pct'] loop
      if jsonb_typeof(v_plan->v_key) is distinct from 'number' then
        raise exception 'invalid target amount'; end if;
      v_number := (v_plan->>v_key)::numeric;
      if v_key in ('trigger_base','trade_base') and (v_number<=0 or v_number>1000000000000)
        or v_key in ('trigger_pct','trade_pct') and (v_number<=-100 or v_number>1000)
        then raise exception 'target amount out of range'; end if;
    end loop;
    if v_plan ? 'leverage' then
      if jsonb_typeof(v_plan->'leverage') is distinct from 'number' then
        raise exception 'invalid leverage'; end if;
      v_number := (v_plan->>'leverage')::numeric;
      if v_number=0 or abs(v_number)>10
        or abs((v_plan->>'trigger_pct')::numeric*v_number-(v_plan->>'trade_pct')::numeric)>0.000001
        then raise exception 'leverage and target do not match'; end if;
    end if;
  end loop;
  insert into public.app_settings(user_id,key,value)
    values(v_user,'trade_target_plans',p_plans)
    on conflict(user_id,key) do update set value=excluded.value,updated_at=now();
  return true;
end;
$$;
revoke all on function public.save_trade_target_plans(jsonb) from public,anon;
grant execute on function public.save_trade_target_plans(jsonb) to authenticated;
