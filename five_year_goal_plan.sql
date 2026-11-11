-- Keep five calendar years of asset or growth-rate targets as one per-user setting.
-- The recorded base remains fixed, so changing a preceding year recomputes later rate targets.
create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_start int;
  v_step record;
  v_value numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_key not in ('home_period', 'compact_mode', 'hide_zero_holdings',
                   'annual_asset_targets', 'five_year_goal_plan') then
    raise exception 'unsupported setting';
  end if;

  if p_key = 'annual_asset_targets' then
    if p_value is null or jsonb_typeof(p_value) <> 'object' then
      raise exception 'annual targets must be an object';
    end if;
    for v_step in select key, value from jsonb_each_text(p_value) loop
      if v_step.key !~ '^(20[0-9]{2}|2100)$'
        or v_step.value !~ '^[1-9][0-9]{0,14}$' then
        raise exception 'invalid annual target';
      end if;
    end loop;
  end if;

  if p_key = 'five_year_goal_plan' then
    if p_value is null or jsonb_typeof(p_value) <> 'object'
      or coalesce(p_value->>'start_year', '') !~ '^20[0-9]{2}$'
      or coalesce(p_value->>'base_date', '') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      or coalesce(jsonb_typeof(p_value->'base_asset'), '') <> 'number'
      or coalesce(jsonb_typeof(p_value->'steps'), '') <> 'object' then
      raise exception 'invalid five year goal plan';
    end if;
    v_start := (p_value->>'start_year')::int;
    if v_start > 2096 or (p_value->>'base_asset')::numeric < 1
      or (p_value->>'base_asset')::numeric > 999999999999999
      or trunc((p_value->>'base_asset')::numeric) <> (p_value->>'base_asset')::numeric
      or (select count(*) from jsonb_object_keys(p_value->'steps')) > 5 then
      raise exception 'invalid five year goal base';
    end if;
    for v_step in select key, value from jsonb_each(p_value->'steps') loop
      if v_step.key !~ '^20[0-9]{2}$'
        or v_step.key::int < v_start or v_step.key::int >= v_start + 5
        or coalesce(jsonb_typeof(v_step.value), '') <> 'object'
        or coalesce(v_step.value->>'kind', '') not in ('asset', 'rate')
        or coalesce(jsonb_typeof(v_step.value->'value'), '') <> 'number' then
        raise exception 'invalid five year goal step';
      end if;
      v_value := (v_step.value->>'value')::numeric;
      if (v_step.value->>'kind') = 'asset' then
        if v_value < 1 or v_value > 999999999999999 or trunc(v_value) <> v_value then
          raise exception 'invalid asset target';
        end if;
      elsif v_value <= -100 or v_value > 10000 or round(v_value, 2) <> v_value then
        raise exception 'invalid rate target';
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
