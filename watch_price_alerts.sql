-- Per-user closing-price thresholds. Rules are only for securities that
-- already have a stored official provider price; no background push is implied.
create or replace function public.save_price_alerts(p_alerts jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_rule jsonb;
  v_security uuid;
  v_target numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_alerts is null or jsonb_typeof(p_alerts)<>'array'
    or jsonb_array_length(p_alerts)>25 then raise exception 'invalid price alert list'; end if;
  for v_rule in select value from jsonb_array_elements(p_alerts) loop
    if jsonb_typeof(v_rule)<>'object'
      or coalesce(v_rule->>'security_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(v_rule->>'direction','') not in ('above','below')
      or jsonb_typeof(v_rule->'target') is distinct from 'number'
      or coalesce(v_rule->>'created_price_date','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      then raise exception 'invalid price alert'; end if;
    v_security := (v_rule->>'security_id')::uuid;
    v_target := (v_rule->>'target')::numeric;
    if v_target<=0 or v_target>1000000000000
      or not exists(select 1 from public.securities s where s.id=v_security)
      or not exists(select 1 from public.daily_security_prices p where p.security_id=v_security)
      then raise exception 'price alert security or target unavailable'; end if;
  end loop;
  insert into public.app_settings(user_id,key,value)
  values(v_user,'watch_price_alerts',p_alerts)
  on conflict(user_id,key) do update set value=excluded.value,updated_at=now();
  return true;
end;
$$;
revoke all on function public.save_price_alerts(jsonb) from public,anon;
grant execute on function public.save_price_alerts(jsonb) to authenticated;
