import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table accounts(id uuid primary key,user_id uuid,mode text,is_active boolean,created_at timestamptz,provider text);
create table account_observations(account_id uuid,source text,balance_date date,fetched_at timestamptz,total_assets_krw numeric,cash_krw numeric);
create table daily_account_snapshots(id uuid default gen_random_uuid(),account_id uuid,snapshot_date date,snapshot_at timestamptz,total_assets numeric,cash numeric,securities_value numeric,external_flow numeric);
create table daily_security_snapshots(account_id uuid,snapshot_date date,quantity numeric,security_id int);
create table daily_security_prices(security_id int,price_date date);
create table live_cash_observation_bridges(account_id uuid,start_date date,end_date date,difference_krw numeric);
create table cash_flows(id int,account_id uuid,currency text,amount numeric,occurred_at timestamptz,fx_rate_to_base numeric,updated_at timestamptz);
create table manual_adjustments(id int,account_id uuid,user_id uuid,active boolean,kind text,amount numeric,occurred_on date,currency text);
create table transactions(account_id uuid,trade_at timestamptz,order_at timestamptz,updated_at timestamptz);
create table sync_logs(id int,account_id uuid,scope text,status text,started_at timestamptz,detail jsonb);
create function get_live_current_account_scope() returns jsonb language sql as $$select '{}'::jsonb$$;
create function get_live_settlement_bridge(date) returns jsonb language sql as $$select '{}'::jsonb$$;
insert into accounts values('${owner}','${owner}','live',true,now(),'kb_securities'),('${other}','${other}','live',true,now(),'kb_securities');
select set_config('request.jwt.claim.sub','${owner}',false);
insert into account_observations
select '${owner}','kb_current_snapshot',(now() at time zone 'Asia/Seoul')::date-d,now()-d*interval '1 day',case when d=1 then 10000000 else 11000000 end,case when d=1 then 10000000 else 11000000 end from generate_series(0,1)d;
insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets,cash,securities_value,external_flow)
select account_id,balance_date,fetched_at,total_assets_krw,cash_krw,0,0 from account_observations;
insert into sync_logs select row_number() over(),account_id,'kb_current_snapshot','success',snapshot_at,'{"manual_overlay_assets":0}' from daily_account_snapshots;`);
const legacy=fs.readFileSync('supabase/build46_daily_performance.sql','utf8');
// Install the actual old table/producer/reader, not a test copy of its algorithm.
await db.exec(legacy);
const helpers=fs.readFileSync('supabase/build254_nav_contract.sql','utf8');
await db.exec(helpers.slice(0,helpers.indexOf('create or replace function public.get_live_nav_reconciliation')));
await db.exec(fs.readFileSync('supabase/build266_nav_reconciliation.sql','utf8'));
const refresh=()=>db.query('select refresh_daily_performance_evidence_for_service($1)',[owner]);
const row=async()=>(await db.query('select * from daily_performance_evidence where account_id=$1',[owner])).rows[0];
const nav=async()=>(await db.query("select get_live_nav_reconciliation('TODAY') r")).rows[0].r;
const sources=async()=>JSON.stringify((await db.query(`select jsonb_build_object('nav',(select jsonb_agg(s order by snapshot_at) from daily_account_snapshots s),'flows',(select jsonb_agg(c order by id) from cash_flows c),'observations',(select jsonb_agg(o order by fetched_at) from account_observations o),'adjustments',(select jsonb_agg(m order by id) from manual_adjustments m)) r`)).rows);
await refresh();
// Old behavior: empty cash ledger + default zero + no cash bridge was certified.
assert.equal((await row()).flow_source_confirmed,true);
assert.equal((await row()).quality,'reconstructed');
assert.equal((await row()).investment_pnl,'1000000');
assert.equal((await nav()).external_flow_confirmed,true);
const beforeVersion=(await nav()).data_version;
const unchanged=await sources();
const migration=fs.readFileSync('supabase/build278_flow_coverage.sql','utf8');
await db.exec(migration);
await db.exec(fs.readFileSync('supabase/build278_nav_reconciliation.sql','utf8'));
assert.equal(await sources(),unchanged);
assert.equal((await row()).flow_source_confirmed,false);
assert.equal((await row()).investment_pnl,null);
assert.equal((await row()).quality,'unavailable');
assert.equal((await nav()).external_flow_confirmed,false);
assert.equal((await nav()).primary_asset_path_pnl,1000000); // recorded arithmetic, still explicitly unverified
assert.notEqual((await nav()).data_version,beforeVersion);
assert.equal((await nav()).calculation_version,'nav-contract-278');
assert((await nav()).reasons.includes('EXTERNAL_FLOW_COVERAGE_UNVERIFIED'));
const derived=JSON.stringify(await row());
await db.exec(migration);assert.equal(JSON.stringify(await row()),derived); // idempotent invalidation
await refresh();
assert.equal((await row()).cash_bridge_gap,null);
assert((await row()).limitations.includes('cash_bridge_evidence_missing'));
// Near zero, actual zero, null, deposits and withdrawals: amount is never completeness.
for(const amount of [null,0,0.5,-0.5,1,-1,2000000,-1000000]){
 await db.query('update daily_account_snapshots set external_flow=$1',[amount]);
 await refresh();const r=await row();
 assert.equal(r.external_flow,amount===null?null:String(amount));
 assert.equal(r.flow_source_confirmed,false);assert.equal(r.investment_pnl,null);assert.equal(r.quality,'unavailable');
}
// Matching and additional, reversed, foreign and other-account events cannot certify coverage.
await db.exec(`update daily_account_snapshots set external_flow=2000000;
insert into cash_flows values(1,'${owner}','KRW',2000000,now(),1,now()),(2,'${owner}','KRW',-1000000,now(),1,now()),(3,'${other}','KRW',2000000,now(),1,now());
insert into manual_adjustments values(1,'${owner}','${owner}',true,'external_flow',2000000,(now() at time zone 'Asia/Seoul')::date,'USD');`);
await refresh();assert.equal((await row()).flow_source_confirmed,false);
await db.exec(`delete from cash_flows;delete from manual_adjustments;
update daily_account_snapshots set snapshot_at=snapshot_at-interval '1 second' where snapshot_date=(now() at time zone 'Asia/Seoul')::date;`);
await refresh();assert.equal((await row()).external_flow,null);
await db.exec(`delete from daily_account_snapshots where snapshot_date=(now() at time zone 'Asia/Seoul')::date`);
await refresh();assert.equal((await row()).external_flow,null);
assert.equal((await nav()).whole_pnl_verified,false);
assert.equal((await nav()).whole_pnl,null);
// Hand-computed arithmetic expectations, separate from certification and source completeness.
for(const [end,flow,expected] of [[11000000,0,1000000],[12000000,2000000,0],[9000000,-1000000,0],[10000000,0,0]]){
 const r=(await db.query('select portfolio_reconcile_values(10000000,$1,$2,$3) r',[end,flow,expected])).rows[0].r;
 assert.equal(r.asset_pnl,expected);assert.equal(r.difference,0);
}
assert.equal((await db.query('select portfolio_reconcile_values(10000000,11000000,null,null) r')).rows[0].r.asset_pnl,null);
// User isolation and source preservation also hold on repeated service refresh.
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
assert.equal((await nav()).recorded_opening_nav,null);
const reliable=(await db.query("select get_live_reliable_performance('TODAY') r")).rows[0].r;
assert.equal(reliable.state,'unavailable');
const preserved=await sources();await refresh();assert.equal(await sources(),preserved);
await db.close();
console.log('Build278: reproduced false zero confirmation; missing/aligned flows, near-zero, matching/extra events, repeated refresh, migration idempotence, source preservation, NAV version and literal arithmetic passed');
