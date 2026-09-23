-- Save annual KB total-asset targets in the existing per-user app settings.
-- Keep the current setting keys and reject malformed year/amount entries.
create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_entry record;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_key not in ('home_period', 'compact_mode', 'hide_zero_holdings', 'annual_asset_targets') then
    raise exception 'unsupported setting';
  end if;

  if p_key = 'annual_asset_targets' then
    if p_value is null or jsonb_typeof(p_value) <> 'object' then
      raise exception 'annual targets must be an object';
    end if;
    for v_entry in select key, value from jsonb_each_text(p_value) loop
      if v_entry.key !~ '^(20[0-9]{2}|2100)$'
        or v_entry.value !~ '^[1-9][0-9]{0,14}$' then
        raise exception 'invalid annual target';
      end if;
    end loop;
  end if;

  insert into public.app_settings (user_id, key, value)
  values (v_user, p_key, p_value)
  on conflict (user_id, key) do update
    set value = excluded.value, updated_at = now();
  return true;
end;
$function$;
