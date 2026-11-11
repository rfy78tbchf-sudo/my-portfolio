-- Synthetic records, actual RPC/roles, transaction rollback. No real account output.
begin;
do $$
declare u uuid:=gen_random_uuid();o uuid:=gen_random_uuid();a uuid:=gen_random_uuid();y int:=extract(year from (now() at time zone 'Asia/Seoul'));d date;
begin
 insert into auth.users(id,instance_id,aud,role)values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated'),(o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
 insert into public.accounts(id,user_id,provider,name,base_currency,mode,is_active)values(a,u,'kb_securities','Synthetic annual account','KRW','live',true);
 insert into public.app_settings(user_id,key,value)values(u,'wealth_auto_plan',jsonb_build_object('version',2,'base_amount',100000000,'base_date',make_date(y-3,10,28),'std_rate',20,'best_rate',30,'revision',0));
 insert into public.manual_subaccount_snapshots(user_id,subaccount_key,account_name,snapshot_date,snapshot_at,total_assets)values(u,'isa','Synthetic ISA',make_date(y-3,10,28),make_date(y-3,10,28)::timestamp at time zone 'Asia/Seoul',20000000);
 for i in 3..4 loop
  d:=make_date(y-6+i,12,31);
  insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets)values(a,d,(d::timestamp+interval '23 hours') at time zone 'Asia/Seoul',80000000+i*10000000);
  insert into public.sync_logs(account_id,scope,status,started_at,detail)values(a,'kb_current_snapshot','success',(d::timestamp+interval '23 hours') at time zone 'Asia/Seoul','{"manual_overlay_assets":20000000}');
 end loop;
 -- New-year balance must never be used as the missing previous Dec 31 amount.
 d:=make_date(y,1,1);
 insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets)values(a,d,d::timestamp at time zone 'Asia/Seoul',999000000);
 insert into public.sync_logs(account_id,scope,status,started_at,detail)values(a,'kb_current_snapshot','success',d::timestamp at time zone 'Asia/Seoul','{"manual_overlay_assets":20000000}');
 perform set_config('annual_test.owner',u::text,true);perform set_config('annual_test.other',o::text,true);perform set_config('annual_test.account',a::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare y int:=extract(year from (now() at time zone 'Asia/Seoul'));r public.wealth_annual_records%rowtype;d jsonb;p jsonb;failed bool;
begin
 d:=public.get_wealth_dashboard();
 if jsonb_array_length(d->'years')<>4 then raise exception 'all annual rows missing';end if;
 select * into r from public.wealth_annual_records where year=y-3;
 if r.end_amount<>110000000 or r.finalized_at is null or r.std_target<>round(100000000*power(1.2,64/365.2425)) then raise exception 'partial first year changed';end if;
 select * into r from public.wealth_annual_records where year=y-2;
 if r.base_amount<>110000000 or r.end_amount<>120000000 or r.std_target<>132000000 then raise exception 'yearly chain or full rate wrong';end if;
 select * into r from public.wealth_annual_records where year=y-1;
 if r.base_amount<>120000000 or r.end_amount is not null or r.finalized_at is not null then raise exception 'stale/future source closed missing year';end if;
 if (d->'current_year'->>'base_amount') is not null then raise exception 'missing baseline replaced by estimate';end if;
 p:=public.set_wealth_scenarios(15,25,0);
 if (p->>'base_amount')::numeric<>100000000 then raise exception 'original plan overwritten';end if;
 if exists(select 1 from public.wealth_annual_records where year<y and (std_rate<>20 or best_rate<>30)) then raise exception 'past goals changed';end if;
 failed:=false;begin perform public.set_wealth_scenarios(16,26,0);exception when others then failed:=sqlerrm='WEALTH_REVISION_CONFLICT';end;
 if not failed then raise exception 'stale revision accepted';end if;
 failed:=false;begin update public.wealth_annual_records set end_amount=1;exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'client can overwrite annual records';end if;
 perform set_config('request.jwt.claim.sub',current_setting('annual_test.other'),true);
 if exists(select 1 from public.wealth_annual_records) then raise exception 'cross-user visibility';end if;
 perform set_config('request.jwt.claim.sub',current_setting('annual_test.owner'),true);
end $$;
reset role;
do $$
declare d date:=make_date(extract(year from (now() at time zone 'Asia/Seoul'))::int-1,12,31);a uuid:=current_setting('annual_test.account')::uuid;
begin
 insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets)values(a,d,(d::timestamp+interval '23 hours') at time zone 'Asia/Seoul',150000000);
 insert into public.sync_logs(account_id,scope,status,started_at,detail)values(a,'kb_current_snapshot','success',(d::timestamp+interval '23 hours') at time zone 'Asia/Seoul','{"manual_overlay_assets":20000000}');
end $$;
-- Scheduler recovers missing year and chains it without a user opening the app.
select app_private.capture_wealth_years();
set local role authenticated;
do $$
declare y int:=extract(year from (now() at time zone 'Asia/Seoul'));d jsonb;r public.wealth_annual_records%rowtype;before_rows jsonb;
begin
 d:=public.get_wealth_dashboard();
 select * into r from public.wealth_annual_records where year=y-1;
 if r.end_amount<>150000000 or r.std_target<>144000000 or r.std_rate<>20 then raise exception 'delayed finalization changed frozen target';end if;
 select * into r from public.wealth_annual_records where year=y;
 if r.base_amount<>150000000 or r.std_target<>172500000 or r.best_target<>187500000 then raise exception 'next year not rebased to actual';end if;
 before_rows:=d->'years';
 if public.get_wealth_dashboard()->'years'<>before_rows then raise exception 'repeat changed history';end if;
 perform public.set_wealth_scenarios(0,0,1);
 select * into r from public.wealth_annual_records where year=y;
 if r.std_target<>150000000 or r.best_target<>150000000 then raise exception 'zero goal wrong';end if;
 if exists(select 1 from public.wealth_annual_records where year<y and std_rate<>20) then raise exception 'past scenario mutated';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','app_private.capture_wealth_years()','execute') or has_function_privilege('anon','app_private.ensure_wealth_years()','execute') or has_function_privilege('anon','public.get_wealth_dashboard()','execute') then raise exception 'unsafe grants';end if;
 if current_setting('request.jwt.claim.sub')<>current_setting('annual_test.owner') then raise exception 'cron subject leaked';end if;
 if app_private.wealth_annual_target(100000000,20,'2028-01-01',false)<>120000000 then raise exception 'leap year full rate wrong';end if;
 if app_private.wealth_annual_target(0,20,'2028-01-01',false)<>0 then raise exception 'zero base wrong';end if;
end $$;
select 'PASS: annual rollover, partial first year, full annual rate, missing/future data, catch-up, frozen history, retries, zero goal, revision conflicts and RLS' result;
rollback;
