-- Annual goals and immutable year-end results. Original wealth_auto_plan is retained.
create table public.wealth_annual_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check(year between 2000 and 9998),
  start_date date not null,
  base_amount numeric(18,0) check(base_amount>=0),
  std_rate numeric not null check(std_rate between 0 and 100),
  best_rate numeric not null check(best_rate between std_rate and 100),
  std_target numeric(18,0), best_target numeric(18,0),
  end_amount numeric(18,0) check(end_amount>=0),
  end_source jsonb, finalized_at timestamptz,
  primary key(user_id,year),
  check(extract(year from start_date)=year),
  check((end_amount is null)=(finalized_at is null))
);
alter table public.wealth_annual_records enable row level security;
create policy wealth_annual_owner_read on public.wealth_annual_records for select to authenticated using((select auth.uid())=user_id);
revoke all on public.wealth_annual_records from public,anon,authenticated;
grant select on public.wealth_annual_records to authenticated;
grant all on public.wealth_annual_records to service_role;

create or replace function app_private.wealth_annual_target(p_base numeric,p_rate numeric,p_start date,p_partial boolean)
returns numeric language sql immutable set search_path='' as $$
 select round(p_base*case when p_partial then power(1+p_rate/100,(make_date(extract(year from p_start)::int,12,31)-p_start)::numeric/365.2425) else 1+p_rate/100 end)
$$;
revoke all on function app_private.wealth_annual_target(numeric,numeric,date,boolean) from public,anon,authenticated;

-- Schema USAGE does not grant EXECUTE: existing scheduler/helper ACLs remain denied.
grant usage on schema app_private to authenticated;

-- Lock the existing plan to serialize dashboard, scenario edits and the scheduler.
-- Caller identity is always auth.uid(); there is no client-supplied owner/date.
create or replace function app_private.ensure_wealth_years()
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); p jsonb; y int; first_year int; current_year int;
  r public.wealth_annual_records%rowtype; prior_amount numeric; src jsonb;tstd numeric;tbest numeric;
  today date:=(now() at time zone 'Asia/Seoul')::date;
begin
  if u is null then raise exception 'authentication required';end if;
  select value into p from public.app_settings where user_id=u and key='wealth_auto_plan' for update;
  if p is null then return;end if;
  first_year:=extract(year from (p->>'base_date')::date);current_year:=extract(year from today);
  for y in first_year..current_year loop
    insert into public.wealth_annual_records(user_id,year,start_date,base_amount,std_rate,best_rate)
      values(u,y,case when y=first_year then (p->>'base_date')::date else make_date(y,1,1) end,
        case when y=first_year then (p->>'base_amount')::numeric else null end,
        (p->>'std_rate')::numeric,(p->>'best_rate')::numeric) on conflict do nothing;
    select * into r from public.wealth_annual_records where user_id=u and year=y for update;
    if r.finalized_at is not null then continue;end if;
    if r.base_amount is null and y>first_year then
      select end_amount into prior_amount from public.wealth_annual_records where user_id=u and year=y-1 and finalized_at is not null;
      r.base_amount:=prior_amount;
    end if;
    tstd:=app_private.wealth_annual_target(r.base_amount,r.std_rate,r.start_date,y=first_year);
    tbest:=app_private.wealth_annual_target(r.base_amount,r.best_rate,r.start_date,y=first_year);
    update public.wealth_annual_records set base_amount=r.base_amount,std_target=tstd,best_target=tbest
      where user_id=u and year=y and (base_amount,std_target,best_target) is distinct from (r.base_amount,tstd,tbest);
    if y<current_year and r.base_amount is not null then
      src:=public.get_wealth_source_at(make_date(y,12,31));
      if coalesce((src->>'ok')::boolean,false) and (src->>'primary_date')::date=make_date(y,12,31) then
        update public.wealth_annual_records set end_amount=(src->>'amount')::numeric,end_source=src,finalized_at=now()
          where user_id=u and year=y and finalized_at is null;
      end if;
    end if;
  end loop;
end $$;
revoke all on function app_private.ensure_wealth_years() from public,anon;
grant execute on function app_private.ensure_wealth_years() to authenticated,service_role;

-- Preserve the existing initialization/current-scope/monthly RPC unchanged.
alter function public.get_wealth_dashboard() rename to get_wealth_dashboard_v2;
revoke all on function public.get_wealth_dashboard_v2() from public,anon;
create function public.get_wealth_dashboard()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; years jsonb; current_record jsonb;
begin
  result:=public.get_wealth_dashboard_v2();
  if not coalesce((result->>'ok')::boolean,false) then return result;end if;
  perform app_private.ensure_wealth_years();
  select coalesce(jsonb_agg(to_jsonb(w)-'user_id' order by year),'[]'::jsonb) into years
    from public.wealth_annual_records w where user_id=(select auth.uid());
  select to_jsonb(w)-'user_id' into current_record from public.wealth_annual_records w
    where user_id=(select auth.uid()) and year=extract(year from (now() at time zone 'Asia/Seoul'));
  return result||jsonb_build_object('years',years,'current_year',current_record);
end $$;
revoke all on function public.get_wealth_dashboard() from public,anon;
grant execute on function public.get_wealth_dashboard() to authenticated;

create or replace function public.set_wealth_scenarios(p_std numeric,p_best numeric,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=(select auth.uid());p jsonb;
begin
  if u is null then raise exception 'authentication required';end if;
  if p_std is null or p_best is null or p_std::text in ('NaN','Infinity','-Infinity') or p_best::text in ('NaN','Infinity','-Infinity')
    or p_std<0 or p_std>100 or p_best<p_std or p_best>100 or round(p_std,2)<>p_std or round(p_best,2)<>p_best
    or p_revision is null or p_revision<0 then raise exception 'invalid scenario';end if;
  perform app_private.ensure_wealth_years();
  select value into p from public.app_settings where user_id=u and key='wealth_auto_plan' for update;
  if p is null then raise exception 'TRACKING_NOT_READY';end if;
  if (p->>'std_rate')::numeric=p_std and (p->>'best_rate')::numeric=p_best then return p;end if;
  if (p->>'revision')::int<>p_revision then raise exception 'WEALTH_REVISION_CONFLICT';end if;
  p:=p||jsonb_build_object('std_rate',p_std,'best_rate',p_best,'revision',p_revision+1);
  update public.app_settings set value=p,updated_at=now() where user_id=u and key='wealth_auto_plan';
  perform app_private.update_wealth_current_rates(p_std,p_best);
  return p;
end $$;

create or replace function app_private.update_wealth_current_rates(p_std numeric,p_best numeric)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid());p jsonb;y int:=extract(year from (now() at time zone 'Asia/Seoul'));
begin
  if u is null then raise exception 'authentication required';end if;
  select value into p from public.app_settings where user_id=u and key='wealth_auto_plan' for update;
  -- Rates can only mirror the validated caller-owned plan, never alter past years.
  if p is null or (p->>'std_rate')::numeric<>p_std or (p->>'best_rate')::numeric<>p_best then raise exception 'invalid scenario';end if;
  update public.wealth_annual_records set std_rate=p_std,best_rate=p_best,
    std_target=app_private.wealth_annual_target(base_amount,p_std,start_date,y=extract(year from (p->>'base_date')::date)),
    best_target=app_private.wealth_annual_target(base_amount,p_best,start_date,y=extract(year from (p->>'base_date')::date))
    where user_id=u and year=y and finalized_at is null;
end $$;
revoke all on function app_private.update_wealth_current_rates(numeric,numeric) from public,anon;
grant execute on function app_private.update_wealth_current_rates(numeric,numeric) to authenticated;

create or replace function app_private.capture_wealth_years()
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner record; old_sub text:=current_setting('request.jwt.claim.sub',true);processed int:=0;errors int:=0;
begin
  for owner in select user_id from public.app_settings where key='wealth_auto_plan' loop
    begin
      perform set_config('request.jwt.claim.sub',owner.user_id::text,true);
      perform app_private.ensure_wealth_years();processed:=processed+1;
    exception when others then errors:=errors+1;end;
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return jsonb_build_object('processed',processed,'errors',errors);
exception when others then perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);raise;
end $$;
revoke all on function app_private.capture_wealth_years() from public,anon,authenticated;
grant execute on function app_private.capture_wealth_years() to service_role;
select cron.schedule('wealth-annual-rollover','35 * * * *','select app_private.capture_wealth_years();');
select app_private.capture_wealth_years();
