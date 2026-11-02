import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8'));
await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function get_live_period_stock_pnl(text) returns jsonb language sql as $$select '{"items":[]}'::jsonb$$;
create table account_observations(id uuid,account_id uuid,source text);
create table position_observations(id uuid,account_id uuid,account_observation_id uuid,security_id uuid,fetched_at timestamptz,quantity numeric,avg_cost numeric,market_price numeric,market_value numeric,currency text);
create table daily_security_snapshots(account_id uuid,security_id uuid,snapshot_date date,quantity numeric,avg_cost numeric,market_price numeric,market_value numeric,currency text,fx_rate_to_base numeric);`);
async function ins(t,r){const k=Object.keys(r);await db.query(`insert into ${t} (${k}) values (${k.map((_,i)=>'$'+(i+1))})`,Object.values(r))}
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
await ins('accounts',{id:id(2),user_id:id(1),provider:'kb_securities',mode:'live',is_active:true,created_at:'2029-01-01'});
await ins('securities',{id:id(3),symbol:'SYNTH',isin:'US0000000001',currency:'USD'});
for(const [n,type,qty,price] of [[4,'buy',10,100],[5,'sell',2,120]])await ins('transactions',{id:id(n),account_id:id(2),security_id:id(3),type,trade_at:'2030-01-09T00:00:00+09:00',order_at:'2030-01-09T00:00:00+09:00',quantity:qty,price,net_amount:(type==='buy'?-1:1)*qty*price,fee:0,tax:0,currency:'USD',source:'api',provider_payload:{dl_amt:String(qty*price),stnd_is_cd:'US0000000001'}});
await ins('account_observations',{id:id(6),account_id:id(2),source:'kb_current_snapshot'});
await ins('position_observations',{id:id(7),account_id:id(2),account_observation_id:id(6),security_id:id(3),fetched_at:'2030-01-08T10:00:00+09:00',quantity:5,avg_cost:90000,market_price:100000,market_value:500,currency:'USD'});
await ins('daily_security_snapshots',{account_id:id(2),security_id:id(3),snapshot_date:'2030-01-08',quantity:5,avg_cost:90000,market_price:100000,market_value:500,currency:'USD',fx_rate_to_base:1000});
await ins('fx_rates',{id:id(8),base_currency:'USD',quote_currency:'KRW',rate_date:'2030-01-09',rate:1000,source:'synthetic'});
const before=JSON.stringify((await db.query('select * from transactions')).rows);
await db.exec('create role anon; create role authenticated;');
const sql=fs.readFileSync('supabase/migrations/20261102091722_preserve_observation_fx.sql','utf8').replace("v_today date := (now() at time zone 'Asia/Seoul')::date","v_today date := date '2030-01-10'");
await db.exec(sql);
async function run(period='1W'){return (await db.query("select get_live_realized_sales($1) r",[period])).rows[0].r}
let r=await run(),sale=r.items[0];assert.equal(r.calculation_version,'realized-sales-v11-observation-fx');assert.equal(sale.status,'order_unverified');assert.equal(sale.realized_local,null);assert.equal(sale.average_cost_estimate.realized_local,60);assert.equal(sale.average_cost_estimate.reference_krw,60000);assert.equal(r.ready_count,0);
// The same dated sale has the same estimate in every containing period.
for(const period of ['THIS_MONTH','1M','3M','6M','YTD','1Y','ALL']){
 const result=await run(period);
 assert.equal(result.items.length,1,period);
 assert.deepEqual(result.items[0].average_cost_estimate,sale.average_cost_estimate,period);
 assert.equal(result.items[0].realized_local,null,period+' does not promote an estimate');
}
assert.equal((await run('TODAY')).items.length,0,'today excludes yesterday sale');
fs.mkdirSync('mobile-artifacts/build245',{recursive:true});fs.writeFileSync('mobile-artifacts/build245/rpc-fixture.json',JSON.stringify(r));
for(const [change,restore] of [
 ["currency='KRW'","currency='USD'"],["fetched_at='2030-01-09T01:00:00+09:00'","fetched_at='2030-01-08T10:00:00+09:00'"],
 ["fetched_at='2029-12-01'","fetched_at='2030-01-08T10:00:00+09:00'"],["avg_cost=0","avg_cost=90000"],[`account_id='${id(9)}'`,`account_id='${id(2)}'`]
]){await db.exec('update position_observations set '+change);assert.equal((await run()).items[0].average_cost_estimate,undefined,change);await db.exec('update position_observations set '+restore)}
await db.exec('update daily_security_snapshots set fx_rate_to_base=null');assert.equal((await run()).items[0].average_cost_estimate,undefined,'missing basis FX never treats KRW average as USD');await db.exec('update daily_security_snapshots set fx_rate_to_base=1000');
await db.exec('update daily_security_snapshots set market_price=100001');assert.equal((await run()).items[0].average_cost_estimate,undefined,'mismatched historical snapshot cannot supply FX');await db.exec('update daily_security_snapshots set market_price=100000');
await db.exec("update account_observations set source='legacy_backfill'");assert.equal((await run()).items[0].average_cost_estimate,undefined,'unverified snapshot source');await db.exec("update account_observations set source='kb_current_snapshot'");
await ins('transactions',{id:id(20),account_id:id(2),security_id:id(3),type:'split_in',trade_at:'2030-01-09',quantity:1,currency:'USD'});assert.equal((await run()).items[0].average_cost_estimate,undefined,'corporate action blocks old average');await db.query('delete from transactions where id=$1',[id(20)]);
// Same source data and fixed date, five alternating warm batches, no network.
const baseline=fs.readFileSync('supabase/build241_realized_dates.sql','utf8').replace('public.get_live_realized_sales(', 'public.baseline_realized_sales(').replace("v_today date := (now() at time zone 'Asia/Seoul')::date","v_today date := date '2030-01-10'");await db.exec(baseline);
const baselineResult=(await db.query("select baseline_realized_sales('1W') r")).rows[0].r;
const stripped=structuredClone(await run());stripped.calculation_version=baselineResult.calculation_version;stripped.items.forEach(x=>delete x.average_cost_estimate);assert.deepEqual(stripped,baselineResult,'all original amounts/status/counts identical');
const times={baseline:[],candidate:[]};for(let i=0;i<5;i++)for(const label of i%2?['candidate','baseline']:['baseline','candidate']){const fn=label==='baseline'?'baseline_realized_sales':'get_live_realized_sales';await db.query(`select ${fn}('1W')`);const start=performance.now();for(let j=0;j<30;j++)await db.query(`select ${fn}('1W')`);times[label].push((performance.now()-start)/30)}
fs.writeFileSync('mobile-artifacts/build245/sql-timing.json',JSON.stringify({condition:'PGlite, warm synthetic two-transaction USD fixture, fixed date, 5 alternating batches of 30 calls, no network',msPerCall:times},null,2));
await db.exec('delete from fx_rates');assert.equal((await run()).items[0].average_cost_estimate.reference_krw,null,'missing FX never becomes zero');
await ins('kb_position_evidence',{id:id(10),account_id:id(2),source:'SPQM2205',symbol:'SYNTH',asset_key:'US0000000001',event_type:'sell',order_date:'2030-01-10',trade_date:'2030-01-10',settlement_date:'2030-01-12',quantity:1,price:110,gross_amount:110,currency:'USD',active:true,evidence:{trade_gross:110}});
r=await run();const pending=r.items.find(x=>x.status==='settlement_pending');assert.equal(pending.average_cost_estimate.realized_local,20);assert.equal(pending.average_cost_estimate.costs_final,false);
const todayPending=(await run('TODAY')).items;
assert.equal(todayPending.length,1,'today includes pending execution before settlement');
assert.deepEqual(todayPending[0].average_cost_estimate,pending.average_cost_estimate);
// Duplicate symbol registry: exact broker asset ID on this account's ledger resolves the original observed security.
await db.exec('update securities set isin=null');await ins('securities',{id:id(11),symbol:'SYNTH',isin:'US0000000001',currency:'USD'});
assert.equal((await run()).items.find(x=>x.status==='settlement_pending').average_cost_estimate.realized_local,20,'ledger asset identity beats duplicate symbol');
await ins('transactions',{id:id(12),account_id:id(2),security_id:id(11),type:'buy',trade_at:'2028-01-01',quantity:1,price:1,net_amount:-1,fee:0,tax:0,currency:'USD',provider_payload:{stnd_is_cd:'US0000000001',dl_amt:'1'}});
assert.equal((await run()).items.find(x=>x.status==='settlement_pending').average_cost_estimate,undefined,'conflicting ledger security identity is not guessed');await db.query('delete from transactions where id=$1',[id(12)]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(99)]);assert.equal((await run()).ok,false);
await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(run,/authentication required/);
assert.equal(JSON.stringify((await db.query('select * from transactions')).rows),before,'ledger unchanged');
// Newly archived FX survives same-day daily snapshot deletion and holding removal.
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
await db.exec('update position_observations set fx_rate_to_base=1000; delete from daily_security_snapshots; delete from holdings;');
assert.equal((await run()).items.find(x=>x.transaction_id===id(5)).average_cost_estimate.realized_local,60);
for(const bad of [0,-1,"'NaN'","'Infinity'","null"]){await db.exec('update position_observations set fx_rate_to_base='+bad);assert.equal((await run()).items.find(x=>x.transaction_id===id(5)).average_cost_estimate,undefined);}
// Exercise the actual capture trigger with two refreshes then a full exit.
await db.exec(`alter table account_observations alter column id set default gen_random_uuid();
alter table account_observations add column fetched_at timestamptz, add column balance_date date, add column cash_krw numeric, add column total_assets_krw numeric, add column source_sync_id uuid, add unique(account_id,fetched_at);
alter table position_observations alter column id set default gen_random_uuid();
alter table position_observations add unique(account_observation_id,security_id);
create table daily_account_snapshots(account_id uuid,snapshot_at timestamptz,snapshot_date date,cash numeric,total_assets numeric,source_sync_id uuid);
create trigger capture after insert on daily_account_snapshots for each row execute function capture_kb_account_observation();`);
await ins('holdings',{account_id:id(2),security_id:id(3),quantity:5,avg_cost:90000,market_price:100000,market_value:500,currency:'USD',fx_rate_to_base:1000});
await ins('daily_account_snapshots',{account_id:id(2),snapshot_at:'2030-01-08T12:00:00+09:00',snapshot_date:'2030-01-08'});
await db.exec('update holdings set fx_rate_to_base=1100');
await ins('daily_account_snapshots',{account_id:id(2),snapshot_at:'2030-01-08T13:00:00+09:00',snapshot_date:'2030-01-08'});
await db.exec('delete from holdings');
await ins('daily_account_snapshots',{account_id:id(2),snapshot_at:'2030-01-08T14:00:00+09:00',snapshot_date:'2030-01-08'});
assert.deepEqual((await db.query("select fx_rate_to_base from position_observations where fetched_at>='2030-01-08T12:00:00+09:00' order by fetched_at")).rows.map(x=>Number(x.fx_rate_to_base)),[1000,1100]);
assert.equal((await db.query('select count(*)::int n from holdings')).rows[0].n,0);
await db.close();console.log('Build246: dated FX capture, refresh isolation, full exit, invalid FX and all Build245 invariants passed');
