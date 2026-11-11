import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
import {responseMigration} from '../experiments/assemble-response-migration273.mjs';
const db=await createRealizedFixture(1);
await db.exec(`create role anon;create role service_role;create function auth.role() returns text language sql as $$select 'service_role'::text$$;
alter table account_observations add fetched_at timestamptz,add balance_date date;
create table sync_logs(account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);
create table portfolio_performance(account_id uuid,performance_date date,daily_pnl numeric);
create table kb_backfill_months(user_id uuid,month date,completed_at timestamptz,ledger_rows int);`);
const source=fs.readFileSync('supabase/reconciliation_build44.sql','utf8');
await db.exec(source.slice(source.indexOf('create table if not exists public.reconciliation_cases'),source.indexOf('create index if not exists reconciliation_cases_status')));
const sql=responseMigration();assert.equal(sql,fs.readFileSync('experiments/response-migration273.sql','utf8'));assert.equal(sql,fs.readFileSync('supabase/migrations/20261111030000_explicit_position_responses.sql','utf8'));
// A failure in the final consumer must roll back earlier schema/reader changes.
await assert.rejects(db.exec(sql.replace(/commit;$/, 'select nonexistent_rollout_guard_273();\ncommit;')));
await db.exec('rollback');
assert.equal((await db.query("select to_regclass('public.kb_position_response_batches') relation")).rows[0].relation,null);
await db.exec(sql);
const funcs=(await db.query("select proname,prosecdef from pg_proc where proname in ('get_live_period_stock_pnl','get_live_realized_cycle_review','get_live_reconciliation_report','get_live_settlement_bridge','get_reconciliation_case_timeline','refresh_reconciliation_cases_for_service')")).rows;
assert.equal(funcs.length,6);for(const f of funcs)assert.equal(f.prosecdef,f.proname==='refresh_reconciliation_cases_for_service');
assert.equal((await db.query('select count(*)::int n from kb_position_response_batches')).rows[0].n,0,'no legacy backfill');
assert.equal((await db.query('select get_live_reconciliation_report() r')).rows[0].r.ok,false);
for(const p of ['1W','THIS_MONTH','1M','3M','ALL'])assert.equal((await db.query('select get_live_period_stock_pnl($1) r',[p])).rows[0].r.complete,false);
assert.equal((await db.query("select get_live_settlement_bridge('2026-11-09') r")).rows[0].r.pending_settlement_net,null);
assert.equal((await db.query('select effective_quantity from live_position_settlement_basis')).rows[0].effective_quantity,null);
const privileges=(await db.query("select has_function_privilege('authenticated','refresh_reconciliation_cases_for_service(uuid)','execute') client_write,has_function_privilege('service_role','read_batch_at_273(text,timestamptz)','execute') service_read,has_function_privilege('anon','get_live_reconciliation_report()','execute') anon_read")).rows[0];
assert.deepEqual(privileges,{client_write:false,service_read:true,anon_read:false});
// Actual worker → bound writer → actual report/service, in the assembled schema.
const worker=fs.readFileSync('supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>worker.slice(worker.indexOf(a),worker.indexOf(b,worker.indexOf(a)));
const code=section('function n(','async function fetchCurrent(')+section('function assertCompleteBalance','function ymd(');
await db.exec(`delete from transactions;delete from holdings;
update securities set symbol='123456',currency='KRW' where id=md5('s1')::uuid;
insert into transactions(id,account_id,security_id,type,quantity,trade_at,currency) values(md5('buy')::uuid,md5('a1')::uuid,md5('s1')::uuid,'buy',2,'2026-11-08','KRW');`);
const user=(await db.query('select user_id from accounts limit 1')).rows[0].user_id;
async function sync(rows){
 await db.exec('delete from kb_position_response_batches;delete from account_observations;delete from sync_logs;delete from holdings;delete from daily_account_snapshots');
 const ctx=vm.createContext({Date,Intl,fetchCurrent:async()=>({appKey:'synthetic',token:'synthetic',domesticRaw:{dataBody:{Record1:rows,nt_asts_val_amt:'1000',val_amt_sum:rows.length?'200':'0',dy_tfnd:'800',fcrncy_tfnd_krw_exch_amt:'0',byng_amt_sum:'180',val_pl_sum:'20'}},overseasRaw:{dataBody:{Record2:[]}}}),fetchNativeBalance:async()=>null,attachNativePrices:x=>x,
 adminRpc:async(name,p)=>{
 if(name==='apply_kb_current_snapshot_for_service'){
  const at=p.p_summary.source_requested_at;
  await db.query("insert into account_observations(id,account_id,fetched_at,balance_date) values(md5('obs')::uuid,md5('a1')::uuid,$1,$2)",[at,p.p_snapshot_date]);
  await db.query("insert into sync_logs values(md5('a1')::uuid,$1,'kb_current_snapshot','success',$2)",[at,JSON.stringify({source_requested_at:at})]);
  await db.query("insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at) values(md5('a1')::uuid,$1,$2)",[p.p_snapshot_date,at]);
  for(const h of p.p_holdings)await db.query("insert into holdings(id,account_id,security_id,as_of,quantity,currency) values(md5('h')::uuid,md5('a1')::uuid,md5('s1')::uuid,$1,$2,$3)",[at,h.quantity,h.currency]);
 }
 if(name==='save_kb_position_batch_for_response_for_service')await db.query('select save_kb_position_batch_for_response_for_service($1,$2,$3,$4,$5)',[user,p.p_source_requested_at,p.p_complete,JSON.stringify(p.p_rows),JSON.stringify(p.p_validation)]);
 if(name==='refresh_reconciliation_cases_for_service')return (await db.query('select refresh_reconciliation_cases_for_service($1) r',[user])).rows[0].r;
 return {ok:true};}});
 vm.runInContext(stripTypeScriptTypes(code),ctx);await ctx.syncCurrent(user);
 return (await db.query('select get_live_reconciliation_report() r')).rows[0].r;
}
const row={is_cd:'123456',crncy_cd:'KRW',hld_q:'2',ec_q:'2',nstmt_b_q:'0',nstmt_s_q:'0',val_amt:'200',byng_amt:'180',ordr_psbl_q:'2'};
let result=await sync([row]);assert.equal(result.ok,true);assert.equal(result.items[0].difference_qty,0);
result=await sync([]);assert.equal(result.ok,false,'worker structural empty never certifies missing position zero');
assert.equal((await db.query("select batch_effective_273(md5('a1')::uuid::text,'123456','KRW',(select max(snapshot_at) from daily_account_snapshots)) q")).rows[0].q,null);
await assert.rejects(sync([{...row,nstmt_b_q:undefined}]),/BALANCE_DOMESTIC_EVIDENCE_INCOMPLETE/,'missing domestic source field is rejected before storage');
assert.equal((await db.query('select count(*)::int n from kb_position_response_batches')).rows[0].n,0);
await db.close();console.log('PASS actual worker to assembled writer/report/service: explicit2 matches ledger2; empty and missing field remain unverified');console.log('PASS assembled migration: late failure rolls back; all six consumers compile together, invoker hardening/ACL preserved, no backfill, legacy-only evidence stays unknown');
