import fs from 'node:fs';import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
import {batchResolutionGate} from '../experiments/batch-resolution-gate273.mjs';
import {batchReconciliationCandidate} from '../experiments/batch-reconciliation-candidate273.mjs';
const db=await createRealizedFixture(1);
await db.exec(`create role anon;create role service_role;create function auth.role() returns text language sql as $$select 'service_role'::text$$;
 alter table account_observations add fetched_at timestamptz,add balance_date date;
 create table sync_logs(account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);`);
const source=fs.readFileSync('supabase/reconciliation_build44.sql','utf8');
const table=source.slice(source.indexOf('create table if not exists public.reconciliation_cases'),source.indexOf('create index if not exists reconciliation_cases_status'));
await db.exec(table);await db.exec('alter table reconciliation_cases drop constraint reconciliation_case_status_check');
const extract=(s,name)=>s.slice(s.indexOf('create or replace function public.'+name),s.indexOf('end $function$;',s.indexOf('create or replace function public.'+name))+16);
for(const f of ['evidence_batch_273.sql','evidence_batch_273_access.sql','batch-reconciliation273.sql'])await db.exec(fs.readFileSync('experiments/'+f,'utf8'));
await db.exec(`delete from transactions;
 insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at) values(md5('a1')::uuid,'2026-11-09','2026-11-09 12:00Z');
 insert into reconciliation_cases(id,account_id,asset_key,security_id,symbol,name,currency) values(md5('case')::uuid,md5('a1')::uuid,'US0000000001',md5('s1')::uuid,'SYNTH1','Synthetic','USD');
 insert into kb_balance_position_evidence values(md5('legacy')::uuid,md5('a1')::uuid,'SYNTH1','2026-11-09 12:01Z',1,2,1,0,'SSQM2952');
 insert into kb_position_evidence(id,account_id,source,source_key,asset_key,symbol,event_type,order_date,settlement_date,quantity,active)
 values(md5('pending')::uuid,md5('a1')::uuid,'SPQM2205','one','US0000000001','SYNTH1','buy','2026-11-09','2026-11-11',1,true);
 create function get_live_reconciliation_report() returns jsonb language sql as $$select jsonb_build_object('ok',true,'balance_date','2026-11-09','balance_at','2026-11-09 12:00Z','items',jsonb_build_array(jsonb_build_object('asset_key','US0000000001','security_id',md5('s1')::uuid,'symbol','SYNTH1','name','Synthetic','state','mismatch','difference_qty',1,'ledger_qty_through_balance_day',1,'actual_qty',2)))$$;`);

await db.exec(fs.readFileSync('experiments/batch-effective273.sql','utf8'));
await db.exec(`create table synthetic_report(payload jsonb);insert into synthetic_report values(get_live_reconciliation_report());
create or replace function get_live_reconciliation_report() returns jsonb language sql as $$select payload from public.synthetic_report$$;`);
const original=extract(source,'refresh_reconciliation_cases_for_service');
await db.exec(original);
const call=async()=>(await db.query("select refresh_reconciliation_cases_for_service(md5('u1')::uuid) r")).rows[0].r;
const status=async()=>(await db.query('select status,user_note from reconciliation_cases')).rows[0];
const initial=(await db.query('select payload from public.synthetic_report')).rows[0].payload;
const item={...initial.items[0],actual_qty:0,ledger_qty_through_balance_day:0,difference_qty:0};
const report=async(items,extra={})=>db.query('update synthetic_report set payload=$1',[{...initial,quantity_coverage_complete:true,items,...extra}]);
const reset=()=>db.exec("update reconciliation_cases set status='source_data_insufficient',kb_quantity=0,user_note='Synthetic note'");
await report([{...item,difference_qty:null}]);await call();assert.equal((await status()).status,'resolved','baseline missing difference becomes zero');
const candidate=batchResolutionGate(batchReconciliationCandidate(source));
await db.exec(extract(candidate,'refresh_reconciliation_cases_for_service'));
const save=async(complete,rows)=>{await db.exec('delete from evidence_batch_273');await db.query("select save_batch_273(md5('a1')::uuid::text,'test','2026-11-09 12:00Z',$1,$2)",[complete,JSON.stringify(rows)]);};
const zero={symbol:'SYNTH1',currency:'USD',source:'SSQM2952',settled_quantity:0,effective_quantity:0,pending_buy_quantity:0,pending_sell_quantity:0};
await save(true,[zero]);
for(const value of [null,'0',false]){
 await reset();await report([{...item,difference_qty:value}]);assert.equal((await call()).reason,'QUANTITY_FIELDS_INCOMPLETE');assert.equal((await status()).status,'source_data_insufficient');assert.equal((await status()).user_note,'Synthetic note');
}
await reset();await report([item],{quantity_coverage_complete:false});assert.equal((await call()).reason,'QUANTITY_COVERAGE_UNVERIFIED');assert.equal((await status()).status,'source_data_insufficient');
await report([item],{items:null});assert.equal((await call()).reason,'QUANTITY_COVERAGE_UNVERIFIED');
await report([item]);await save(false,[]);assert.equal((await call()).reason,'QUANTITY_EVIDENCE_UNVERIFIED');
await save(true,[{...zero,effective_quantity:2,settled_quantity:2}]);assert.equal((await call()).reason,'QUANTITY_EVIDENCE_UNVERIFIED');
await save(true,[zero]);await call();assert.equal((await status()).status,'resolved');assert.equal((await status()).user_note,'Synthetic note');
// Omitted case: empty report is not proof of closure. Positive or partial balance must survive.
await reset();await report([]);await save(true,[{...zero,effective_quantity:2,settled_quantity:2}]);await call();assert.equal((await status()).status,'source_data_insufficient');
await save(false,[]);await call();assert.equal((await status()).status,'source_data_insufficient');
await save(true,[{...zero,currency:'KRW'}]);await call();assert.equal((await status()).status,'source_data_insufficient');
await save(true,[]);await call();assert.equal((await status()).status,'source_data_insufficient');
await save(true,[zero]);await call();assert.equal((await status()).status,'resolved');
// One invalid row prevents all mutations, even if an earlier row is valid.
await reset();await report([item,{...item,difference_qty:null}]);await call();assert.equal((await status()).status,'source_data_insufficient');
// Historical missing observations must not manufacture a previously matched day.
await db.exec("insert into account_observations(id,account_id,fetched_at,balance_date) values(md5('historical')::uuid,md5('a1')::uuid,'2026-11-01 12:00Z','2026-11-01')");
await reset();await report([item]);await call();
assert.equal((await db.query('select first_mismatch_from from reconciliation_cases')).rows[0].first_mismatch_from,null);
await db.close();console.log('PASS resolution gate: null/string/bool/partial report no writes; explicit zero resolves; omitted positive/partial/currency mismatch stays open; notes preserved');
