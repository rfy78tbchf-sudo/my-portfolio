import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRealizedFixture} from './fixtures/realized257.mjs';
import {batchOpeningCandidate} from '../experiments/batch-opening-candidate273.mjs';
const db=await createRealizedFixture(1);
const original=fs.readFileSync('supabase/build260_closed_opening_quantity.sql','utf8');
const candidate=batchOpeningCandidate(original);
await db.exec(`create role anon;create role service_role;alter table account_observations add fetched_at timestamptz;create table sync_logs(account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);`);
await db.exec(fs.readFileSync('experiments/evidence_batch_273.sql','utf8'));
await db.exec(fs.readFileSync('experiments/evidence_batch_273_access.sql','utf8'));
await db.exec(original.replace('public.get_live_period_stock_pnl(', 'public.baseline_period_pnl(').replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));
// Compile and execute the entire consumer, not only a surrogate predicate.
await db.exec(candidate.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));
for(const period of ['오늘','1W','THIS_MONTH','1M','3M','6M','YTD','1Y','ALL']) {
 const r=(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r;
 assert.equal(r.complete,false); // missing fixture marks/prices never become verified
 assert.deepEqual(r,(await db.query('select baseline_period_pnl($1) r',[period])).rows[0].r);
}
// Exercise the exact opening CTE from each full function with literal synthetic positions.
const cte=s=>s.slice(s.indexOf('native_opening_balance_checks as materialized ('),s.indexOf('), opening_boundary_checks as materialized ('))+ ')';
const query=s=>`with account as(select * from accounts where user_id=auth.uid()),
 positions as(select 'US0000000001'::text asset_key,'SYNTH1'::text symbol,'USD'::text currency,2::numeric start_qty,0 provisional_count,date '2026-11-09' start_date,timestamptz '2026-11-10 12:00Z' cutoff),
 dated_transactions as(select *,order_at effective_at from transactions where false),keys as(select id,isin asset_key from securities),${cte(s).replaceAll('p_period',"'1W'")}
 select count(*)::int n from native_opening_balance_checks`;
await db.exec(`insert into kb_position_evidence(id,account_id,source,source_key,asset_key,symbol,event_type,order_date,settlement_date,quantity,price,currency,active,evidence)
 values(md5('pending-open')::uuid,md5('a1')::uuid,'SPQM2205','one','US0000000001','SYNTH1','buy','2026-11-06','2026-11-10',1,100,'USD',true,'{"occurrences":1}');
 insert into kb_balance_position_evidence values(md5('legacy')::uuid,md5('a1')::uuid,'SYNTH1','2026-11-09 02:00Z',1,2,1,0,'SSQM2952');`);
const row={symbol:'SYNTH1',currency:'USD',source:'SSQM2952',effective_quantity:2,settled_quantity:1,pending_buy_quantity:1,pending_sell_quantity:0};
const save=(id,at,complete,rows)=>db.query("select save_batch_273(md5('a1')::uuid::text,$1,$2,$3,$4)",[id,at,complete,JSON.stringify(rows)]);
const check=async expected=>assert.equal((await db.query(query(candidate))).rows[0].n,expected);
await check(0); // no envelope; legacy positive row is insufficient
assert.equal((await db.query(query(original))).rows[0].n,1);
await save('valid','2026-11-09 02:00Z',true,[row]);await check(1);
await save('future','2026-11-10 02:00Z',true,[]);await check(1);
await save('next-premarket','2026-11-09 09:00Z',true,[]);await check(1);
await save('partial','2026-11-09 03:00Z',false,[row]);await check(0);
await save('empty','2026-11-09 04:00Z',true,[]);await check(0);
assert.equal((await db.query(query(original))).rows[0].n,1,'baseline reuses obsolete row');
await save('null','2026-11-09 05:00Z',true,[{...row,settled_quantity:null}]);await check(0);
await save('currency','2026-11-09 06:00Z',true,[{...row,currency:'KRW'}]);await check(0);
await save('reacquired','2026-11-09 07:00Z',true,[row]);await check(1);
await db.exec("update kb_position_evidence set evidence='{\"occurrences\":2}'");await check(0);
await db.exec("update kb_position_evidence set evidence='{\"occurrences\":1}';select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");await check(0);
await db.exec("select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);delete from evidence_batch_273");
await save('too-early','2026-11-09 00:59:59Z',true,[row]);await check(0);
await save('lower-inclusive','2026-11-09 01:00:00Z',true,[row]);await check(1);
// Summer DST has different UTC boundaries. Expectations are fixed clock times.
await db.exec("delete from evidence_batch_273;update kb_position_evidence set order_date='2026-07-08',settlement_date='2026-07-10'");
const summer=()=>db.query(query(candidate).replaceAll('2026-11-09','2026-07-09').replaceAll('2026-11-10','2026-07-10'));
await save('summer-before','2026-07-08 23:59:59Z',true,[row]);assert.equal((await summer()).rows[0].n,0);
await save('summer-start','2026-07-09 00:00:00Z',true,[row]);assert.equal((await summer()).rows[0].n,1);
await save('summer-next-session','2026-07-09 08:00:00Z',true,[]);assert.equal((await summer()).rows[0].n,1);
await db.close();console.log('Batch opening: full consumer compilation/9 periods and opening-window, empty, partial, null, currency, duplicate, ownership checks passed');
