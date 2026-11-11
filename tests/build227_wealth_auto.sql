-- Synthetic users and observations only; complete rollback, no real data output.
begin;
do $$
declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();a uuid:=gen_random_uuid();d date:=(date_trunc('month',now() at time zone 'Asia/Seoul')-interval '1 month'+interval '14 days')::date;
begin
 insert into auth.users(id,instance_id,aud,role)values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated'),(other_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
 insert into public.accounts(id,user_id,provider,name,base_currency,mode,is_active)values(a,u,'kb_securities','Synthetic wealth account','KRW','live',true);
 insert into public.manual_subaccount_snapshots(user_id,subaccount_key,account_name,snapshot_date,snapshot_at,total_assets)values
 (u,'isa','Synthetic ISA',d-1,(d-1)::timestamp at time zone 'Asia/Seoul',20000000),
 (u,'isa','Synthetic ISA',d+1,(d+1)::timestamp at time zone 'Asia/Seoul',30000000);
 insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets)values
 (a,d,(d::timestamp+interval '12 hours') at time zone 'Asia/Seoul',120000000),
 (a,d+1,((d+1)::timestamp+interval '12 hours') at time zone 'Asia/Seoul',220000000);
 insert into public.sync_logs(account_id,scope,status,started_at,detail)values
 (a,'kb_current_snapshot','success',(d::timestamp+interval '12 hours') at time zone 'Asia/Seoul','{"manual_overlay_assets":20000000}'),
 (a,'kb_current_snapshot','success',((d+1)::timestamp+interval '12 hours') at time zone 'Asia/Seoul','{"manual_overlay_assets":20000000}');
 perform set_config('wealth_test.owner',u::text,true);perform set_config('wealth_test.other',other_user::text,true);perform set_config('wealth_test.account',a::text,true);perform set_config('wealth_test.day',d::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare d jsonb;p jsonb;failed boolean;
begin
 d:=public.get_wealth_dashboard();p:=d->'plan';
 if not (d->>'ok')::boolean or (p->>'base_amount')::numeric<>230000000 then raise exception 'current app baseline mismatch';end if;
 if (public.get_wealth_dashboard()->'plan')<>p then raise exception 'baseline reset on repeat';end if;
 d:=public.get_wealth_source_at(current_setting('wealth_test.day')::date);
 if (d->>'amount')::numeric<>120000000 then raise exception 'future data leaked into 15th';end if;
 p:=public.set_wealth_scenarios(15,25,0);
 if (p->>'base_amount')::numeric<>230000000 or (p->>'revision')::int<>1 then raise exception 'scenario changed baseline';end if;
 perform public.set_wealth_scenarios(15,25,0);
 failed:=false;begin perform public.set_wealth_scenarios(20,30,0);exception when others then failed:=sqlerrm='WEALTH_REVISION_CONFLICT';end;
 if not failed then raise exception 'stale scenario accepted';end if;
 failed:=false;begin perform public.set_wealth_scenarios(30,20,1);exception when others then failed:=true;end;
 if not failed then raise exception 'inverted scenario accepted';end if;
 failed:=false;begin perform public.set_wealth_scenarios('NaN',30,1);exception when others then failed:=true;end;
 if not failed then raise exception 'NaN accepted';end if;
 failed:=false;begin insert into public.wealth_monthly_observations(user_id,as_of,amount,source) values(auth.uid(),current_setting('wealth_test.day')::date,1,'{}');exception when others then failed:=true;end;
 if not failed then raise exception 'manual record write accepted';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','app_private.capture_wealth_monthlies()','execute') or has_function_privilege('anon','public.get_wealth_dashboard()','execute') then raise exception 'function grants unsafe';end if;
end $$;
-- Simulate tracking that started before the past 15th, without changing a real plan.
update public.app_settings set value=jsonb_set(value,'{base_date}',to_jsonb((current_setting('wealth_test.day')::date-1)::text))
 where user_id=current_setting('wealth_test.owner')::uuid and key='wealth_auto_plan';
select app_private.capture_wealth_monthlies();
do $$
declare r public.wealth_monthly_observations%rowtype; result jsonb;
begin
 select * into r from public.wealth_monthly_observations where user_id=current_setting('wealth_test.owner')::uuid;
 if r.amount<>120000000 or r.as_of<>current_setting('wealth_test.day')::date or not r.finalized then raise exception 'scheduled capture failed';end if;
 if (select count(*) from public.wealth_monthly_observations where user_id=current_setting('wealth_test.owner')::uuid)<>1 then raise exception 'stale 16th balance relabelled as 15th';end if;
 perform app_private.capture_wealth_monthlies();
 if (select count(*) from public.wealth_monthly_observations where user_id=current_setting('wealth_test.owner')::uuid)<>1 then raise exception 'duplicate monthly record';end if;
 if current_setting('request.jwt.claim.sub')<>current_setting('wealth_test.owner') then raise exception 'cron subject leaked';end if;
end $$;
set local role authenticated;
do $$
begin
 perform set_config('request.jwt.claim.sub',current_setting('wealth_test.other'),true);
 if exists(select 1 from public.wealth_monthly_observations) then raise exception 'cross-user records visible';end if;
 if (public.get_wealth_dashboard()->>'ok')::boolean is distinct from false then raise exception 'other-user baseline leak';end if;
end $$;
reset role;
select 'automatic baseline, immutable start, historical cutoff, 15th-only capture, idempotency, scenario conflict and RLS passed' result;
rollback;
