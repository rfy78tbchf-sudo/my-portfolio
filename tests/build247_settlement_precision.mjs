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
await db.exec('create role anon; create role authenticated;');
const freeze=s=>s.replace("v_today date := (now() at time zone 'Asia/Seoul')::date","v_today date := date '2030-01-10'");
await db.exec(freeze(fs.readFileSync('supabase/migrations/20261102091722_preserve_observation_fx.sql','utf8')));
await db.exec('delete from transactions');
const sale={id:id(30),account_id:id(2),security_id:id(3),type:'sell',trade_at:'2030-01-10T00:00:00+09:00',order_at:'2030-01-09T00:00:00+09:00',quantity:10,price:123.456789,net_amount:1233.56,fee:1,tax:0.00789,currency:'USD',source:'api',provider_payload:{stnd_is_cd:'US0000000001',dl_amt:'1234.56789'}};
const evidence={id:id(31),account_id:id(2),source:'SPQM2205',symbol:'SYNTH',asset_key:'US0000000001',event_type:'sell',order_date:'2030-01-09',trade_date:'2030-01-09',settlement_date:'2030-01-10',quantity:10,price:123.456788,gross_amount:1233.56,currency:'USD',active:true,evidence:{occurrences:1,trade_gross:1234.56788}};
await ins('transactions',sale);await ins('kb_position_evidence',evidence);
let compareOriginal=false;
async function run(){const result=(await db.query("select get_live_realized_sales('1W') r")).rows[0].r;if(compareOriginal)assert.deepEqual(result,(await db.query("select baseline_realized_sales('1W') r")).rows[0].r,'optimized full output matches original');return result}
const baseline=await run();assert.equal(baseline.items.length,2,'reproduces price-precision duplicate');
const ledgerBefore=JSON.stringify((await db.query('select * from transactions')).rows);
await db.exec(freeze(fs.readFileSync(process.env.REALIZED_SQL_SOURCE||'supabase/migrations/20261104045000_reconcile_settlement_precision.sql','utf8')));
if(process.env.REALIZED_SQL_SOURCE){await db.exec(freeze(fs.readFileSync('supabase/migrations/20261104045000_reconcile_settlement_precision.sql','utf8')).replace('public.get_live_realized_sales(','public.baseline_realized_sales('));compareOriginal=true;}
const fixed=await run();assert.equal(fixed.items.length,1);assert.equal(fixed.pending_settlement_count,0);
assert.deepEqual(fixed.items[0],baseline.items.find(i=>i.transaction_id===id(30)),'settled amount/status/estimate unchanged');
// Each absent/conflicting piece of evidence must retain the pending row.
for(const [table,change,restore] of [
 ['transactions','net_amount=1233.55','net_amount=1233.56'],
 ['transactions',"order_at='2030-01-08'","order_at='2030-01-09T00:00:00+09:00'"],
 ['transactions','quantity=9','quantity=10'],
 ['transactions','fee=2','fee=1'],
 ['transactions',"source='manual'","source='api'"],
 ['kb_position_evidence','price=123.457','price=123.456788'],
 ['kb_position_evidence',"evidence='{}'::jsonb",`evidence='${JSON.stringify(evidence.evidence)}'::jsonb`],
 ['kb_position_evidence',`evidence='${JSON.stringify({...evidence.evidence,occurrences:2})}'::jsonb`,`evidence='${JSON.stringify(evidence.evidence)}'::jsonb`],
 ['kb_position_evidence',`evidence='${JSON.stringify({...evidence.evidence,trade_gross:1200})}'::jsonb`,`evidence='${JSON.stringify(evidence.evidence)}'::jsonb`]
]){await db.exec('update '+table+' set '+change);assert.equal((await run()).items.filter(i=>i.status==='settlement_pending').length,1,change);await db.exec('update '+table+' set '+restore)}
await ins('transactions',{...sale,id:id(32)});assert.equal((await run()).items.filter(i=>i.status==='settlement_pending').length,1,'ambiguous ledger not linked');await db.query('delete from transactions where id=$1',[id(32)]);
await ins('kb_position_evidence',{...evidence,id:id(33)});assert.equal((await run()).items.filter(i=>i.status==='settlement_pending').length,2,'ambiguous evidence not linked');await db.query('delete from kb_position_evidence where id=$1',[id(33)]);
await ins('transactions',{...sale,id:id(34),account_id:id(99)});assert.equal((await run()).items.length,1,'other account does not affect link');await db.query('delete from transactions where id=$1',[id(34)]);
await db.exec('update kb_position_evidence set price=123.456789');assert.equal((await run()).items.length,1,'exact-price behavior preserved');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(99)]);assert.equal((await run()).ok,false);
assert.equal(JSON.stringify((await db.query('select * from transactions')).rows),ledgerBefore,'no ledger mutation');
console.log('Build247: reproduced duplicate; unique reconciled match removes only pending row; ambiguity/cost/source/date/price/auth guards pass.');
await db.close();
