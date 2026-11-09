import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
import {candidateSql} from '../experiments/realized-array-candidate256.mjs';
const db=await createRealizedFixture(3);
const original=readFileSync('supabase/migrations/20261104045000_reconcile_settlement_precision.sql','utf8');
const optimized=readFileSync('supabase/build257_realized_accumulation.sql','utf8');
assert.equal(optimized.split('$function$')[1],candidateSql(original).split('$function$')[1]);
assert.equal(optimized,readFileSync('supabase/migrations/20261109194323_accumulate_realized_items.sql','utf8'));
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec(freeze(original).replace('public.get_live_realized_sales(','public.original_realized_sales('));
await db.exec(freeze(optimized));
let checks=0;
async function compare(period='1W',account=null){
 let a;
 try{a=(await db.query('select original_realized_sales($1,$2) r',[period,account])).rows[0].r;}
 catch(error){
  // Existing nested stock RPC can return JSON null items in an empty period.
  // This accumulation change must not silently replace that failure with zero.
  assert.equal(error.code,'22023');
  await assert.rejects(db.query('select get_live_realized_sales($1,$2) r',[period,account]),e=>e.code===error.code);
  checks++;return {unchangedError:error.code};
 }
 const b=(await db.query('select get_live_realized_sales($1,$2) r',[period,account])).rows[0].r;
 assert.deepEqual(b,a,'complete output, amounts, nulls, status and order: '+period);checks++;return b;
}
const periods=['TODAY','1W','THIS_MONTH','1M','3M','6M','YTD','1Y','ALL'];
for(const p of periods)await compare(p);
await db.exec("update transactions set order_at=timestamptz '2026-11-08 00:00+09' where security_id=md5('s1')::uuid");
assert.ok((await compare()).items.some(i=>i.status==='order_unverified'&&i.realized_local===null));
await db.exec(`insert into kb_position_evidence(id,account_id,source,source_key,asset_key,symbol,event_type,order_date,settlement_date,quantity,price,gross_amount,currency,active,evidence)
 values(md5('pending')::uuid,md5('a1')::uuid,'SPQM2205','pending','US0000000002','SYNTH2','sell','2026-11-09','2026-11-11',1,110,110,'USD',true,'{}');`);
assert.ok((await compare()).items.some(i=>i.status==='settlement_pending'));
await db.exec(`insert into securities(id,symbol,name,currency,isin) values(md5('kr')::uuid,'000001','Synthetic KR','KRW','KR0000000001');
 insert into realized_pnl_events(id,account_id,security_id,provider_event_id,realized_date,quantity,sell_price,sell_amount,buy_amount,fee,tax,realized_pnl,currency,source,provider_payload)
 values(md5('official')::uuid,md5('a1')::uuid,md5('kr')::uuid,'KB:SSQM2442:test','2026-11-08',1,110,110,100,1,1,8,'KRW','api','{"trd_dl_ccd":"01","trd_dt":"20261108","shrt_is_cd":"A000001"}');`);
assert.ok((await compare()).items.some(i=>i.status==='broker_official'&&i.realized_local===8));
for(const p of periods)await compare(p);
const ledger=JSON.stringify((await db.query('select * from transactions order by id')).rows);
for(let i=0;i<3;i++)await compare('ALL');
assert.equal(JSON.stringify((await db.query('select * from transactions order by id')).rows),ledger);
assert.equal((await compare('1W','00000000-0000-0000-0000-000000000099')).ok,false);
await db.exec("select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");
assert.equal((await compare()).ok,false);
await db.exec("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(db.query("select get_live_realized_sales('ALL')"),/authentication required/);
await db.exec("select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);delete from transactions;delete from kb_position_evidence;delete from realized_pnl_events");
await db.exec(`create or replace function public.get_live_period_stock_pnl(p_period text default '1M') returns jsonb language sql stable as $$select '{"items":[]}'::jsonb$$`);
assert.deepEqual((await compare('ALL')).items,[],'empty stays an empty JSON array');
await db.close();console.log('Build257 full-output differential checks passed:',checks);
