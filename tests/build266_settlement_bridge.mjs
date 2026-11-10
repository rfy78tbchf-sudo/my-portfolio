import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table accounts(id uuid,user_id uuid,provider text,mode text,is_active boolean,created_at timestamptz);
create table daily_account_snapshots(account_id uuid,snapshot_date date,snapshot_at timestamptz,total_assets numeric,cash numeric,securities_value numeric);
create table securities(id int,symbol text,currency text,isin text,market text default 'KRX');
create table kb_balance_position_evidence(id int,account_id uuid,symbol text,observed_at timestamptz,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,source text);
create table transactions(id int,account_id uuid,security_id int,type text,quantity numeric,net_amount numeric,gross_amount numeric,trade_at timestamptz,source text,currency text,provider_payload jsonb);
create table realized_pnl_events(id int,account_id uuid,source text,currency text,provider_event_id text,provider_payload jsonb,realized_date date,quantity numeric,buy_amount numeric,sell_amount numeric);
insert into accounts values('${owner}','${owner}','kb_securities','live',true,now()),('${other}','${other}','kb_securities','live',true,now());
insert into securities(id,symbol,currency,isin) values(1,'A000001','KRW',null),(2,'000001','KRW','KR0000000001');
select set_config('request.jwt.claim.sub','${owner}',false);
insert into daily_account_snapshots values('${owner}','2026-01-02','2026-01-02T12:00:00Z',9990,10000,1000);
insert into kb_balance_position_evidence values(1,'${owner}','A000001','2026-01-02T12:00:02Z',0,10,10,0,'SSQM2952');`);
await db.exec(fs.readFileSync('supabase/build266_settlement_bridge.sql','utf8'));
const ledger={stnd_is_cd:'KR0000000001',dl_dt:'20260106',dl_amt:'1000',ec_amt:'1010'};
const official={stnd_is_cd:'KR0000000001',trd_dl_ccd:'02',trd_dt:'20260102'};
await db.query(`insert into transactions values(1,$1,2,'buy',10,-1010,-1000,'2026-01-06T00:00:00+09','api','KRW',$2)`,[owner,ledger]);
await db.query(`insert into realized_pnl_events values(1,$1,'api','KRW','KB:SSQM2442:buy',$2,'2026-01-02',10,1000,0)`,[owner,official]);
const get=async(day='2026-01-02')=>(await db.query('select get_live_settlement_bridge($1) r',[day])).rows[0].r;
let r=await get();
assert.equal(r.pending_settlement_net,-1010);assert.equal(r.recorded_component_gap,-1010);assert.equal(r.remaining_component_gap,0);
assert.equal(r.quantity_matches,true);assert.equal(r.whole_pnl_verified,false);assert.equal(r.valuation_time_verified,false);
assert.deepEqual(r.items[0].trades[0].transaction_ids,[1]);
assert.equal(r.items[0].trades[0].execution_date,'2026-01-02');
const initialVersion=r.data_version;
// Correction is reflected, including a one-unit unexplained gap; no tolerance.
await db.exec(`update transactions set net_amount=-1011,provider_payload=jsonb_set(provider_payload,'{ec_amt}','"1011"') where id=1`);
r=await get();assert.equal(r.pending_settlement_net,-1011);assert.equal(r.remaining_component_gap,1);assert.notEqual(r.data_version,initialVersion);
await db.exec(`update transactions set net_amount=-1010,provider_payload=jsonb_set(provider_payload,'{ec_amt}','"1010"') where id=1`);
// Duplicate official evidence and duplicate ledger events do not certify a match.
await db.exec(`insert into realized_pnl_events select 2,account_id,source,currency,provider_event_id||':dup',provider_payload,realized_date,quantity,buy_amount,sell_amount from realized_pnl_events where id=1`);
r=await get();assert.equal(r.pending_settlement_net,null);assert.equal(r.quantity_matches,false);
await db.exec('delete from realized_pnl_events where id=2');
await db.exec(`insert into transactions select 2,account_id,security_id,type,quantity,net_amount,gross_amount,trade_at,source,currency,provider_payload from transactions where id=1`);
assert.equal((await get()).pending_settlement_net,null);
await db.exec('delete from transactions where id=2');
// Future execution, malformed original cash, and missing official data stay unknown.
await db.exec(`update realized_pnl_events set realized_date='2026-01-03',provider_payload=jsonb_set(provider_payload,'{trd_dt}','"20260103"')`);
assert.equal((await get()).pending_settlement_net,null);
await db.exec(`update realized_pnl_events set realized_date='2026-01-02',provider_payload=jsonb_set(provider_payload,'{trd_dt}','"20260102"')`);
await db.exec(`update transactions set provider_payload=provider_payload-'ec_amt'`);
assert.equal((await get()).pending_settlement_net,null);
await db.query('update transactions set provider_payload=$1',[ledger]);
await db.exec(`update kb_balance_position_evidence set effective_quantity=9`);
assert.equal((await get()).pending_settlement_net,null);
await db.exec(`update kb_balance_position_evidence set effective_quantity=10`);
// Split fills: 4*100+6*100, total payable 1010; order of arrival is irrelevant.
await db.exec(`update transactions set quantity=4,net_amount=-404,gross_amount=-400,provider_payload=jsonb_set(jsonb_set(provider_payload,'{dl_amt}','"400"'),'{ec_amt}','"404"') where id=1`);
await db.query(`insert into transactions values(2,$1,1,'buy',6,-606,-600,'2026-01-06T00:00:00+09','api','KRW',$2)`,[owner,{...ledger,dl_amt:'600',ec_amt:'606'}]);
r=await get();assert.equal(r.pending_settlement_net,-1010);assert.deepEqual(r.items[0].trades[0].transaction_ids,[1,2]);
// Zero net quantity still has two economic legs; neither side may be discarded.
await db.exec(`update kb_balance_position_evidence set pending_sell_quantity=10,effective_quantity=0`);
await db.query(`insert into transactions values(3,$1,1,'sell',10,1090,1100,'2026-01-06T00:00:00+09','api','KRW',$2)`,[owner,{...ledger,dl_amt:'1100',ec_amt:'1090'}]);
await db.query(`insert into realized_pnl_events values(3,$1,'api','KRW','KB:SSQM2442:sell',$2,'2026-01-02',10,1000,1100)`,[owner,{...official,trd_dl_ccd:'01'}]);
r=await get();assert.equal(r.pending_settlement_net,80);assert.equal(r.remaining_component_gap,-1090);
// Settled day: no future cash. Genuine zero is available only with position evidence.
await db.exec(`insert into daily_account_snapshots values('${owner}','2026-01-06','2026-01-06T12:00:00Z',10080,10080,0);
insert into kb_balance_position_evidence values(2,'${owner}','A000001','2026-01-06T12:00:02Z',0,0,0,0,'SSQM2952');`);
assert.equal((await get('2026-01-06')).pending_settlement_net,0);
assert.equal((await get('2026-01-07')).pending_settlement_net,null);
// No other user's observations are selected even under an administrative test role.
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
r=await get();assert.equal(r.ok,false);assert.deepEqual(r.items,[]);assert.equal(r.pending_settlement_net,null);
await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
assert.equal((await get()).ok,false);
// Integrate the actual NAV contract with synthetic owner data. This also tests
// that missing foreign-flow FX cannot silently become a zero deposit.
await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);
create role service_role;
alter table daily_account_snapshots add column id uuid default gen_random_uuid();
alter table transactions add column order_at timestamptz;
alter table transactions add column updated_at timestamptz default now();
create table sync_logs(id int,account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);
create table manual_adjustments(id int,user_id uuid,account_id uuid,active boolean,kind text,occurred_on date,amount numeric,currency text);
create table cash_flows(id int,account_id uuid,occurred_at timestamptz,amount numeric,currency text,fx_rate_to_base numeric,updated_at timestamptz);
create table daily_performance_evidence(account_id uuid,source text,end_date date,flow_source_confirmed boolean);
create function get_live_current_account_scope() returns jsonb language sql as $$select '{}'::jsonb$$;
insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets,cash,securities_value)
values('${owner}',(now() at time zone 'Asia/Seoul')::date-1,now()-interval '1 day',10000000,10000000,0),
('${owner}',(now() at time zone 'Asia/Seoul')::date,now(),11000000,11000000,0);
insert into sync_logs select 1,account_id,snapshot_at,'kb_current_snapshot','success','{"manual_overlay_assets":0}' from daily_account_snapshots where snapshot_date>=(now() at time zone 'Asia/Seoul')::date-1;
insert into daily_performance_evidence values('${owner}','kb_current_snapshot',(now() at time zone 'Asia/Seoul')::date,true);`);
const base=fs.readFileSync('supabase/build254_nav_contract.sql','utf8');
await db.exec(base.slice(0,base.indexOf('create or replace function public.get_live_nav_reconciliation')));
await db.exec(fs.readFileSync('supabase/build266_nav_reconciliation.sql','utf8'));
const nav=async()=>(await db.query("select get_live_nav_reconciliation('오늘') r")).rows[0].r;
r=await nav();assert.equal(r.primary_asset_path_pnl,1000000);assert.equal(r.recorded_external_flow,0);assert.equal(r.external_flow_confirmed,true);
assert.equal(r.whole_pnl,null);assert.equal(r.whole_pnl_verified,false);
const emptyFlowVersion=r.data_version;
await db.exec(`insert into cash_flows values(1,'${owner}',now()-interval '1 hour',100,'USD',null,now())`);
r=await nav();assert.equal(r.recorded_external_flow,null);assert.equal(r.primary_asset_path_pnl,null);assert.equal(r.external_flow_confirmed,false);
assert(r.reasons.includes('EXTERNAL_FLOW_FX_MISSING'));assert.notEqual(r.data_version,emptyFlowVersion);
await db.exec('update cash_flows set fx_rate_to_base=1400');
r=await nav();assert.equal(r.recorded_external_flow,140000);assert.equal(r.primary_asset_path_pnl,860000);
assert.equal(r.external_flow_confirmed,false);assert(r.reasons.includes('FLOW_REFLECTION_TIMING_UNVERIFIED'));
await db.exec(`delete from cash_flows;insert into manual_adjustments values(1,'${owner}','${owner}',true,'external_flow',(now() at time zone 'Asia/Seoul')::date,100,'USD')`);
assert.equal((await nav()).recorded_external_flow,null);
await db.exec("update manual_adjustments set currency='KRW',amount=2000000");
r=await nav();assert.equal(r.recorded_external_flow,2000000);assert.equal(r.primary_asset_path_pnl,-1000000);
const adjustmentVersion=r.data_version;
await db.exec('update manual_adjustments set amount=1000000');
r=await nav();assert.equal(r.primary_asset_path_pnl,0);assert.notEqual(r.data_version,adjustmentVersion);
await db.close();
console.log('Build266: independent settlement cash, split fills, correction, duplicates, missing data, zero-net positions, settlement day and user isolation passed');
