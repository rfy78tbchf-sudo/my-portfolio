// Run the existing server target/rollover implementation in isolated Postgres.
// Only auth and source lookup are synthetic boundaries; no production writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema app_private;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create table public.app_settings(user_id uuid,key text,value jsonb);
 create table public.synthetic_closes(day date primary key,amount numeric);
 create function public.get_wealth_source_at(d date) returns jsonb language sql as $$select coalesce((select jsonb_build_object('ok',true,'primary_date',day,'amount',amount) from public.synthetic_closes where day=d),'{"ok":false}'::jsonb)$$;
 insert into auth.users values(auth.uid());
 insert into public.app_settings values(auth.uid(),'wealth_auto_plan','{"base_date":"2026-10-28","base_amount":100000000,"std_rate":20,"best_rate":30}');
 select set_config('test.today','2026-10-31',false);`);
 let source=fs.readFileSync('wealth_annual_growth.sql','utf8');
 source=source.slice(0,source.indexOf('-- Preserve the existing initialization')).replace("(now() at time zone 'Asia/Seoul')::date", "current_setting('test.today')::date");
 await db.exec(source);
 async function run(){await db.exec('select app_private.ensure_wealth_years()');return (await db.query('select year,base_amount::float8,std_target::float8,best_target::float8,end_amount::float8,finalized_at from public.wealth_annual_records order by year')).rows;}
 const initial=await run();const goal=initial[0].std_target;
 assert.equal(goal,Math.round(100000000*1.2**(64/365.2425)));
 await db.exec("insert into public.synthetic_closes values('2026-10-31',125000000)");
 assert.deepEqual(await run(),initial,'today assets cannot change this year target');
 await db.exec("select set_config('test.today','2027-01-01',false);insert into public.synthetic_closes values('2027-01-01',999000000)");
 let rows=await run();assert.equal(rows[0].std_target,goal);assert.equal(rows[0].end_amount,null);assert.equal(rows[1].std_target,null,'new year balance cannot replace missing December31 source');
 await db.exec("insert into public.synthetic_closes values('2026-12-31',125000000)");
 rows=await run();assert.equal(rows[0].std_target,goal);assert.equal(rows[0].end_amount,125000000);assert.ok(rows[0].finalized_at);
 assert.equal(rows[1].base_amount,125000000);assert.equal(rows[1].std_target,150000000);assert.equal(rows[1].best_target,162500000);
 assert.deepEqual(await run(),rows,'repeat collection is idempotent');
 await db.exec("update public.synthetic_closes set amount=150000000 where day='2027-01-01'");
 assert.deepEqual(await run(),rows,'new year live growth cannot raise its frozen target');
 console.log('Build244 actual SQL: fixed first-year goal, missing year-end protection, excess carried into next-year base, 20/30% goals and idempotence passed');
}finally{await db.close()}
