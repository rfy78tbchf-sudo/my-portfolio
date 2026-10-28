-- Automatic wealth tracking: fixed current-app baseline, user-editable scenarios,
-- and one server-owned observation for every Korean-calendar 15th.
create table public.wealth_monthly_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  as_of date not null check (extract(day from as_of)=15),
  amount numeric(18,0) not null check (amount>=0),
  source jsonb not null,
  captured_at timestamptz not null default now(),
  finalized boolean not null default false,
  primary key(user_id,as_of)
);
alter table public.wealth_monthly_observations enable row level security;
create policy wealth_observations_owner_read on public.wealth_monthly_observations for select to authenticated
  using ((select auth.uid())=user_id);
revoke all on public.wealth_monthly_observations from public,anon,authenticated;
grant select on public.wealth_monthly_observations to authenticated;
grant all on public.wealth_monthly_observations to service_role;

-- Historical counterpart to current app scope. No source captured after the
-- requested Korean day is used; primary and ISA are not double-counted.
create or replace function public.get_wealth_source_at(p_date date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  u uuid:=(select auth.uid()); cutoff timestamptz; s record; primary_value numeric;
  primary_at timestamptz; manual_value numeric; manual_at timestamptz; manual_count int;
  observation record; evidence record;
begin
  if u is null then raise exception 'authentication required';end if;
  if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Seoul')::date then raise exception 'invalid date';end if;
  cutoff:=least((p_date+1)::timestamp at time zone 'Asia/Seoul',now());
  select x.*,l.detail into s from public.daily_account_snapshots x
    join public.accounts a on a.id=x.account_id
    left join lateral(select detail from public.sync_logs l where l.account_id=x.account_id
      and l.scope='kb_current_snapshot' and l.status='success' and l.started_at=x.snapshot_at order by l.id desc limit 1) l on true
    where a.user_id=u and a.mode='live' and a.is_active and a.provider='kb_securities'
      and x.snapshot_date<=p_date and x.snapshot_at<cutoff order by x.snapshot_at desc limit 1;
  if s.id is null or not coalesce(s.detail?'manual_overlay_assets',false) then return jsonb_build_object('ok',false,'reason','SOURCE_NOT_READY');end if;
  primary_value:=s.total_assets-(s.detail->>'manual_overlay_assets')::numeric;primary_at:=s.snapshot_at;
  select sum(x.total_assets),max(x.snapshot_at),count(*) into manual_value,manual_at,manual_count
    from (select distinct on(subaccount_key) total_assets,snapshot_at from public.manual_subaccount_snapshots
      where user_id=u and provider='kb_securities' and active and snapshot_date<=p_date and snapshot_at<cutoff
      order by subaccount_key,snapshot_date desc,snapshot_at desc,created_at desc) x;
  if manual_count=1 then
    select o.*,coalesce(c.corrected_total,o.total_assets) effective_total into observation
      from public.account_total_observations o join public.accounts a on a.id=o.account_id
      left join lateral(select corrected_total from public.account_total_observation_corrections c
        where c.observation_id=o.id and c.created_at<cutoff order by c.created_at desc,c.id desc limit 1)c on true
      where a.user_id=u and a.provider='kb_securities_manual' and a.mode='live' and a.is_active
        and o.captured_at<cutoff and o.recorded_at<cutoff and o.captured_at>manual_at
      order by o.captured_at desc,o.recorded_at desc limit 1;
    if observation.id is not null then
      manual_value:=observation.effective_total;manual_at:=observation.captured_at;
      select e.* into evidence from public.kb_account_scope_evidence e join public.accounts a on a.id=e.account_id
        where e.id=observation.scope_evidence_id and a.user_id=u and e.broker_capture_at<cutoff;
      if evidence.id is not null and evidence.broker_capture_at>=primary_at then
        primary_value:=evidence.broker_primary_total;primary_at:=evidence.broker_capture_at;
      end if;
    end if;
  end if;
  if primary_value is null or manual_value is null or primary_value+manual_value<0 then return jsonb_build_object('ok',false,'reason','TOTAL_NOT_READY');end if;
  return jsonb_build_object('ok',true,'amount',round(primary_value+manual_value),'primary_at',primary_at,
    'isa_at',manual_at,'primary_amount',primary_value,'isa_amount',manual_value,
    'primary_date',(primary_at at time zone 'Asia/Seoul')::date,'source','app_account_scope');
end $$;

create or replace function public.get_wealth_dashboard()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=(select auth.uid()); p jsonb; s jsonb; records jsonb; current_scope jsonb;
  today date:=(now() at time zone 'Asia/Seoul')::date;
begin
  if u is null then raise exception 'authentication required';end if;
  select value into p from public.app_settings where user_id=u and key='wealth_auto_plan';
  current_scope:=public.get_live_current_account_scope();
  if p is null then
    if coalesce((current_scope->>'ok')::boolean,false) is not true or current_scope->>'current_display_total' is null
      or (current_scope->>'current_display_total')::numeric<=0 then
      return jsonb_build_object('ok',false,'reason','CURRENT_ASSET_NOT_READY');end if;
    p:=jsonb_build_object('version',2,'base_amount',round((current_scope->>'current_display_total')::numeric),
      'base_date',today,'base_at',now(),'std_rate',20,'best_rate',30,'revision',0,
      'primary_at',current_scope->'current_primary_observed_at','isa_at',current_scope->'current_isa_capture_at');
    insert into public.app_settings(user_id,key,value) values(u,'wealth_auto_plan',p) on conflict(user_id,key) do nothing;
    select value into p from public.app_settings where user_id=u and key='wealth_auto_plan';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('as_of',as_of,'amount',amount,'finalized',finalized,'source',source) order by as_of),'[]'::jsonb)
    into records from public.wealth_monthly_observations where user_id=u;
  return jsonb_build_object('ok',true,'plan',p,'records',records,'today',today,
    'current',case when current_scope->>'current_display_total' is not null then jsonb_build_object(
      'amount',round((current_scope->>'current_display_total')::numeric),'as_of',today,
      'primary_at',current_scope->'current_primary_observed_at','isa_at',current_scope->'current_isa_capture_at') else null end);
end $$;

create or replace function public.set_wealth_scenarios(p_std numeric,p_best numeric,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=(select auth.uid());p jsonb;
begin
  if u is null then raise exception 'authentication required';end if;
  if p_std is null or p_best is null or p_std::text in ('NaN','Infinity','-Infinity') or p_best::text in ('NaN','Infinity','-Infinity')
    or p_std<0 or p_std>100 or p_best<p_std or p_best>100 or round(p_std,2)<>p_std or round(p_best,2)<>p_best
    or p_revision is null or p_revision<0 then raise exception 'invalid scenario';end if;
  select value into p from public.app_settings where user_id=u and key='wealth_auto_plan' for update;
  if p is null then raise exception 'TRACKING_NOT_READY';end if;
  if (p->>'std_rate')::numeric=p_std and (p->>'best_rate')::numeric=p_best then return p;end if;
  if (p->>'revision')::int<>p_revision then raise exception 'WEALTH_REVISION_CONFLICT';end if;
  p:=p||jsonb_build_object('std_rate',p_std,'best_rate',p_best,'revision',p_revision+1);
  update public.app_settings set value=p,updated_at=now() where user_id=u and key='wealth_auto_plan';
  return p;
end $$;

-- Only the scheduler/service can write observations; no user ID parameter is
-- exposed. The old JWT subject is restored, including on exceptions.
create or replace function app_private.capture_wealth_monthlies()
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner record; target record; src jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true);
  today date:=(now() at time zone 'Asia/Seoul')::date;captured int:=0;missing int:=0;errors int:=0;
begin
  for owner in select user_id,value from public.app_settings where key='wealth_auto_plan' loop
    begin
      perform set_config('request.jwt.claim.sub',owner.user_id::text,true);
      for target in select (d+interval '14 days')::date as target_date from generate_series(
        date_trunc('month',(owner.value->>'base_date')::date),date_trunc('month',today),interval '1 month')d
        where (d+interval '14 days')::date between (owner.value->>'base_date')::date and today
          and not exists(select 1 from public.wealth_monthly_observations w where w.user_id=owner.user_id and w.as_of=(d+interval '14 days')::date and w.finalized)
      loop
        src:=public.get_wealth_source_at(target.target_date);
        if coalesce((src->>'ok')::boolean,false) and (src->>'primary_date')::date=target.target_date then
          insert into public.wealth_monthly_observations(user_id,as_of,amount,source,finalized)
            values(owner.user_id,target.target_date,(src->>'amount')::numeric,src,target.target_date<today)
            on conflict(user_id,as_of) do update set amount=excluded.amount,source=excluded.source,
              captured_at=now(),finalized=excluded.finalized where not wealth_monthly_observations.finalized;
          captured:=captured+1;
        else missing:=missing+1;end if;
      end loop;
    exception when others then errors:=errors+1;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return jsonb_build_object('captured',captured,'missing',missing,'errors',errors);
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);raise;
end $$;
revoke all on function public.get_wealth_source_at(date) from public,anon;
revoke all on function public.get_wealth_dashboard() from public,anon;
revoke all on function public.set_wealth_scenarios(numeric,numeric,integer) from public,anon;
grant execute on function public.get_wealth_source_at(date),public.get_wealth_dashboard(),public.set_wealth_scenarios(numeric,numeric,integer) to authenticated;
revoke all on function app_private.capture_wealth_monthlies() from public,anon,authenticated;
grant execute on function app_private.capture_wealth_monthlies() to service_role;
select cron.schedule('wealth-monthly-15-capture','25 * * * *','select app_private.capture_wealth_monthlies();');
