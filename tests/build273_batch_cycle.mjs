import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
import {batchCycleCandidate} from '../experiments/batch-cycle-candidate273.mjs';
const db=await createRealizedFixture(1);
await db.exec(`create role anon;create role service_role;alter table account_observations add fetched_at timestamptz;
create table sync_logs(account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);
create table kb_backfill_months(user_id uuid,month date,completed_at timestamptz,ledger_rows int);
insert into kb_backfill_months values(md5('u1')::uuid,'2026-11-01','2026-11-10',2);
delete from transactions;
insert into transactions(id,account_id,security_id,type,trade_at,quantity,net_amount,fee,tax,currency,source,provider_payload) values
(md5('buy')::uuid,md5('a1')::uuid,md5('s1')::uuid,'buy','2026-11-04 12:00+09',2,-200,0,0,'USD','api','{"dl_amt":"200"}'),
(md5('sell')::uuid,md5('a1')::uuid,md5('s1')::uuid,'sell','2026-11-06 12:00+09',2,220,0,0,'USD','api','{"dl_amt":"220"}');
insert into kb_balance_position_evidence values
(md5('old-open')::uuid,md5('a1')::uuid,'SYNTH1','2026-11-01 12:00+09',0,0,0,0,'SSQM2952'),
(md5('before-sale')::uuid,md5('a1')::uuid,'SYNTH1','2026-11-06 08:00+09',0,0,0,0,'SSQM2952');`);
for(const f of ['evidence_batch_273.sql','evidence_batch_273_access.sql'])await db.exec(fs.readFileSync('experiments/'+f,'utf8'));
const sql=fs.readFileSync('supabase/build54e_lifecycle_review.sql','utf8');
await db.exec(sql.replaceAll('get_live_realized_cycle_review','baseline_cycle'));
await db.exec(batchCycleCandidate(sql).replaceAll('now()',"timestamptz '2026-11-10 12:00+09'"));
const get=async()=>(await db.query("select get_live_realized_cycle_review('SYNTH1') r")).rows[0].r;
const baseline=(await db.query("select baseline_cycle('SYNTH1') r")).rows[0].r;
assert.equal(baseline.status,'closed_cycle_verified');assert.equal(baseline.candidate_cash_difference,20);
const zero={symbol:'SYNTH1',currency:'USD',source:'SSQM2952',effective_quantity:0,settled_quantity:0,pending_buy_quantity:0,pending_sell_quantity:0};
const save=(id,at,complete,rows)=>db.query("select save_batch_273(md5('a1')::uuid::text,$1,$2,$3,$4)",[id,at,complete,JSON.stringify(rows)]);
assert.equal((await get()).status,'opening_or_ending_balance_unverified');
await save('old','2026-11-01 12:00+09',true,[zero]);
await save('same-day','2026-11-06 08:00+09',true,[zero]);
assert.equal((await get()).opening_zero_verified,false);assert.equal((await get()).ending_zero_verified,false);
await save('opening','2026-11-03 20:00+09',true,[zero]);
await save('ending','2026-11-07 10:00+09',true,[]);assert.equal((await get()).ending_zero_verified,false,'structural empty is not authoritative zero');
await db.exec("delete from evidence_batch_273 where response_id='ending'");
await save('ending','2026-11-07 10:00+09',true,[zero]);
let r=await get();assert.equal(r.status,'closed_cycle_verified');assert.equal(r.candidate_cash_difference,20);
assert.equal(r.buy_quantity,2);assert.equal(r.sell_quantity,2);
await save('reacquired','2026-11-08 10:00+09',true,[{...zero,effective_quantity:1,settled_quantity:1}]);
assert.equal((await get()).ending_zero_verified,false);
await save('partial','2026-11-08 11:00+09',false,[]);assert.equal((await get()).ending_zero_verified,false);
await save('null','2026-11-08 12:00+09',true,[{...zero,effective_quantity:null}]);assert.equal((await get()).ending_zero_verified,false);
await save('wrong-currency','2026-11-08 13:00+09',true,[{...zero,currency:'KRW'}]);assert.equal((await get()).ending_zero_verified,false);
await save('closed-again','2026-11-08 14:00+09',true,[zero]);assert.equal((await get()).ending_zero_verified,true);
await save('future','2026-11-11 14:00+09',true,[{...zero,effective_quantity:1,settled_quantity:1}]);assert.equal((await get()).ending_zero_verified,true);
await save('opening-partial','2026-11-03 21:00+09',false,[]);assert.equal((await get()).opening_zero_verified,false);
await db.exec("select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");assert.equal((await get()).ok,false);
await db.exec("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(get(),/authentication required/);
await db.close();console.log('PASS actual cycle consumer: stale/same-day zero rejected; empty rejected, explicit zero, rebuy, partial, null, currency, future, owner checks; literal 2 units / USD20');
