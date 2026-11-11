-- Annual wealth records reuse user-owned app_settings and its ownership RLS.
-- One document per year; row lock + revision prevents lost updates across devices.
create or replace function public.get_wealth_growth(p_year integer)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_value jsonb; v_previous jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_year is null or p_year not between 2000 and 2100 then raise exception 'invalid year'; end if;
  select value into v_value from public.app_settings where user_id=v_user and key='wealth_growth_'||p_year;
  select value->'months'->'12' into v_previous from public.app_settings where user_id=v_user and key='wealth_growth_'||(p_year-1);
  return coalesce(v_value,jsonb_build_object('year',p_year,'revision',0,'base',null,'months','{}'::jsonb))
    || jsonb_build_object('previous_december',case when v_previous->>'as_of'=(p_year-1)||'-12-31' then v_previous else null end);
end;
$$;

create or replace function public.save_wealth_growth(p_year integer,p_month integer,p_amount numeric,p_as_of date,p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_value jsonb; v_entry jsonb;
  v_today date := (now() at time zone 'Asia/Seoul')::date; v_key text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_year is null or p_year not between 2000 and extract(year from v_today)::int
    or p_month is null or p_month not between 0 and 12
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount<0 or p_amount>999999999999999 or trunc(p_amount)<>p_amount
    or (p_month=0 and p_amount=0) or p_as_of is null or p_as_of>v_today
    or p_revision is null or p_revision<0 then raise exception 'invalid wealth record'; end if;
  if (p_month=0 and p_as_of<>make_date(p_year-1,12,31))
    or (p_month>0 and (extract(year from p_as_of)<>p_year or extract(month from p_as_of)<>p_month))
    then raise exception 'invalid record date'; end if;
  v_key := 'wealth_growth_'||p_year;
  insert into public.app_settings(user_id,key,value)
    values(v_user,v_key,jsonb_build_object('year',p_year,'revision',0,'base',null,'months','{}'::jsonb))
    on conflict(user_id,key) do nothing;
  select value into v_value from public.app_settings where user_id=v_user and key=v_key for update;
  v_entry := case when p_month=0 then v_value->'base' else v_value->'months'->p_month::text end;
  -- Lost response followed by the same request is a successful idempotent retry.
  if v_entry->>'as_of'=p_as_of::text and (v_entry->>'amount')::numeric=p_amount then return v_value; end if;
  if coalesce((v_value->>'revision')::int,0)<>p_revision then raise exception 'WEALTH_REVISION_CONFLICT'; end if;
  v_entry := jsonb_build_object('amount',p_amount,'as_of',p_as_of,'saved_at',now());
  if p_month=0 then v_value := jsonb_set(v_value,'{base}',v_entry);
  else v_value := jsonb_set(v_value,array['months',p_month::text],v_entry); end if;
  v_value := jsonb_set(v_value,'{revision}',to_jsonb(p_revision+1));
  update public.app_settings set value=v_value,updated_at=now() where user_id=v_user and key=v_key;
  return v_value;
end;
$$;
revoke all on function public.get_wealth_growth(integer) from public,anon;
revoke all on function public.save_wealth_growth(integer,integer,numeric,date,integer) from public,anon;
grant execute on function public.get_wealth_growth(integer) to authenticated;
grant execute on function public.save_wealth_growth(integer,integer,numeric,date,integer) to authenticated;
