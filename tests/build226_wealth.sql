-- Isolated synthetic users; all changes roll back. No broker or real-owner writes.
begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role) values
    (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (v,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  perform set_config('wealth_test.owner',u::text,true);
  perform set_config('wealth_test.other',v::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare d jsonb;failed boolean;yr int:=extract(year from now() at time zone 'Asia/Seoul')::int;
begin
  d:=public.get_wealth_growth(yr);
  if (d->>'revision')::int<>0 or d->'base'<>'null'::jsonb then raise exception 'empty year failed'; end if;
  d:=public.save_wealth_growth(yr,0,100000000,make_date(yr-1,12,31),0);
  if (d->>'revision')::int<>1 then raise exception 'base save failed'; end if;
  d:=public.save_wealth_growth(yr,1,125000000,make_date(yr,1,1),1);
  if (d->'months'->'1'->>'amount')::numeric<>125000000 then raise exception 'month save failed'; end if;
  d:=public.save_wealth_growth(yr,1,125000000,make_date(yr,1,1),1);
  if (d->>'revision')::int<>2 then raise exception 'idempotent retry failed'; end if;
  failed:=false;
  begin perform public.save_wealth_growth(yr,1,120000000,make_date(yr,1,1),1); exception when others then failed:=sqlerrm='WEALTH_REVISION_CONFLICT'; end;
  if not failed then raise exception 'stale revision not rejected'; end if;
  d:=public.save_wealth_growth(yr,1,0,make_date(yr,1,1),2);
  if (d->'months'->'1'->>'amount')::numeric<>0 or (select count(*) from jsonb_object_keys(d->'months'))<>1 then raise exception 'zero or monthly uniqueness failed'; end if;
  failed:=false;begin perform public.save_wealth_growth(yr,0,0,make_date(yr-1,12,31),3); exception when others then failed:=true;end;
  if not failed then raise exception 'zero base accepted';end if;
  failed:=false;begin perform public.save_wealth_growth(yr,1,-1,make_date(yr,1,1),3);exception when others then failed:=true;end;
  if not failed then raise exception 'negative amount accepted';end if;
  failed:=false;begin perform public.save_wealth_growth(yr,1,'NaN'::numeric,make_date(yr,1,1),3);exception when others then failed:=true;end;
  if not failed then raise exception 'NaN accepted';end if;
  failed:=false;begin perform public.save_wealth_growth(yr,1,1.1,make_date(yr,1,1),3);exception when others then failed:=true;end;
  if not failed then raise exception 'fractional won accepted';end if;
  failed:=false;begin perform public.save_wealth_growth(yr,1,10,make_date(yr,2,1),3);exception when others then failed:=true;end;
  if not failed then raise exception 'wrong month accepted';end if;
  failed:=false;begin perform public.save_wealth_growth(yr,1,10,make_date(yr+1,1,1),3);exception when others then failed:=true;end;
  if not failed then raise exception 'future date accepted';end if;
  perform public.save_wealth_growth(yr-1,12,90000000,make_date(yr-1,12,30),0);
  if public.get_wealth_growth(yr)->'previous_december'<>'null'::jsonb then raise exception 'non year-end carry forward accepted';end if;
  perform public.save_wealth_growth(yr-1,12,90000000,make_date(yr-1,12,31),1);
  if (public.get_wealth_growth(yr)->'previous_december'->>'amount')::numeric<>90000000 then raise exception 'December carry forward failed';end if;
  perform set_config('request.jwt.claim.sub',current_setting('wealth_test.other'),true);
  if (public.get_wealth_growth(yr)->>'revision')::int<>0 then raise exception 'cross-user read';end if;
  if exists(select 1 from public.app_settings where user_id=current_setting('wealth_test.owner')::uuid) then raise exception 'RLS isolation failed';end if;
  perform public.save_wealth_growth(yr,0,70000000,make_date(yr-1,12,31),0);
  perform set_config('request.jwt.claim.sub',current_setting('wealth_test.owner'),true);
  if (public.get_wealth_growth(yr)->'base'->>'amount')::numeric<>100000000 then raise exception 'cross-user overwrite';end if;
  perform set_config('request.jwt.claim.sub','',true);
  failed:=false;begin perform public.get_wealth_growth(yr);exception when others then failed:=true;end;
  if not failed then raise exception 'unauthenticated read accepted';end if;
end $$;
reset role;
select 'wealth validation, idempotency, conflict, year rollover and RLS passed' as test_result;
rollback;
