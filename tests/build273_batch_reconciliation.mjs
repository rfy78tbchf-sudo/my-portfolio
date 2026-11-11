import fs from 'node:fs';import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
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
const names=['get_reconciliation_case_timeline','refresh_reconciliation_cases_for_service'];
for(const n of names)await db.exec(extract(source,n));
const timeline=async()=>(await db.query("select get_reconciliation_case_timeline(md5('case')::uuid) r")).rows[0].r;
const refresh=async()=>{await db.exec("select refresh_reconciliation_cases_for_service(md5('u1')::uuid)");return (await db.query('select status from reconciliation_cases')).rows[0].status;};
assert.equal((await timeline()).balance_evidence.effective,2);assert.equal(await refresh(),'settlement_pending');
const candidate=batchReconciliationCandidate(source);
for(const n of names)await db.exec(extract(candidate,n));
assert.equal((await timeline()).balance_evidence.status,'missing');assert.equal(await refresh(),'likely_missing_trade');
const row={symbol:'SYNTH1',currency:'USD',source:'SSQM2952',settled_quantity:1,effective_quantity:2,pending_buy_quantity:1,pending_sell_quantity:0};
const set=async(complete,rows,at='2026-11-09 12:00Z')=>{await db.exec('delete from evidence_batch_273');await db.query("select save_batch_273(md5('a1')::uuid::text,'test',$1,$2,$3)",[at,complete,JSON.stringify(rows)]);};
await set(true,[row]);assert.equal(await refresh(),'settlement_pending');assert.equal((await timeline()).balance_evidence.effective,2);
for(const [complete,rows,status] of [[true,[],'complete_absent'],[false,[row],'incomplete'],[true,[{...row,effective_quantity:null}],'quantity_unknown'],[true,[{...row,currency:'KRW'}],'complete_absent']]){
 await set(complete,rows);assert.equal((await timeline()).balance_evidence.status,status);assert.equal((await timeline()).balance_evidence.effective,null);assert.equal(await refresh(),'likely_missing_trade');
}
await set(true,[row],'2026-11-09 11:59Z');assert.equal((await timeline()).balance_evidence.status,'cutoff_mismatch');assert.equal(await refresh(),'likely_missing_trade');
await set(true,[row],'2026-11-09 12:01Z');assert.equal((await timeline()).balance_evidence.status,'missing');assert.equal(await refresh(),'likely_missing_trade');
await db.exec("alter function get_reconciliation_case_timeline(uuid) security invoker;grant select on all tables in schema public to authenticated;set role authenticated;select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false)");assert.equal((await timeline()).balance_evidence.status,'missing');
await db.exec("select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");await assert.rejects(timeline(),/CASE_NOT_FOUND/);
await db.close();console.log('PASS actual timeline/service: future legacy effective2 no longer certifies settlement; exact complete2 preserved; empty/partial/null/currency/stale/future unknown and owner checked');
