import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRealizedFixture} from './fixtures/realized257.mjs';
const db=await createRealizedFixture(3);
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const full=readFileSync('supabase/build254_existing_periods.sql','utf8');
const baseline=full.slice(full.indexOf('CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl'));
const candidate=readFileSync('supabase/build258_empty_period_items.sql','utf8');
assert.equal(candidate,readFileSync('supabase/migrations/20261109202318_normalize_empty_period_items.sql','utf8'));
await db.exec(freeze(baseline).replace('public.get_live_period_stock_pnl(','public.original_stock_pnl('));
await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
const rows=[];
for(let run=0;run<5;run++){
 const start=performance.now();
 await assert.rejects(db.query("select get_live_realized_sales('TODAY')"),e=>e.code==='22023');
 rows.push({variant:'before',scenario:'empty_today',run,ms:performance.now()-start,outcome:'22023'});
}
await db.exec(freeze(candidate));
let checks=0;
async function compare(period){
 const a=(await db.query('select original_stock_pnl($1) r',[period])).rows[0].r;
 const b=(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r;
 assert.deepEqual(b,{...a,items:a.items===null?[]:a.items},'only empty collection representation may change');
 checks++;return b;
}
const periods=['오늘','1W','THIS_MONTH','1M','3M','6M','YTD','1Y','ALL'];
await db.exec('set role authenticated');
for(const p of periods)await compare(p);
const empty=await compare('오늘');
assert.deepEqual(empty.items,[]);assert.equal(empty.candidate_count,0);
assert.equal(empty.pnl_krw,null);assert.equal(empty.complete,false);
for(let run=0;run<5;run++){
 const start=performance.now();
 const r=(await db.query("select get_live_realized_sales('TODAY') r")).rows[0].r;
 assert.equal(r.ok,true);assert.deepEqual(r.items,[]);assert.deepEqual(r.closed_cycles,[]);
 rows.push({variant:'after',scenario:'empty_today',run,ms:performance.now()-start,outcome:'empty_result'});
}
// Missing prices/FX remain real rows with unknown amounts, never an empty/zero result.
const incomplete=await compare('1W');assert.ok(incomplete.items.length>0);
assert.ok(incomplete.items.some(x=>x.pnl_krw===null));assert.equal(incomplete.complete,false);
await db.exec('reset role;delete from transactions;delete from holdings;');
for(const p of periods){const r=await compare(p);assert.deepEqual(r.items,[]);assert.equal(r.pnl_krw,null);assert.equal(r.complete,false);}
// An unsettled sell still exists, with unknown cost; empty stock rows cannot erase it.
await db.exec(`insert into kb_position_evidence(id,account_id,source,source_key,asset_key,symbol,event_type,order_date,settlement_date,quantity,price,gross_amount,currency,active,evidence)
 values(md5('pending')::uuid,md5('a1')::uuid,'SPQM2205','pending','US0000000002','SYNTH2','sell','2026-11-09','2026-11-11',1,110,110,'USD',true,'{}');`);
await db.exec('set role authenticated');
await compare('오늘');
const pending=(await db.query("select get_live_realized_sales('TODAY') r")).rows[0].r;
assert.equal(pending.items.length,1);assert.equal(pending.items[0].status,'settlement_pending');assert.equal(pending.items[0].realized_local,null);
await db.exec("select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");
const other=await compare('ALL');assert.equal(other.ok,false);assert.deepEqual(other.items,[]);
assert.equal((await db.query("select get_live_realized_sales('ALL') r")).rows[0].r.ok,false);
await db.exec("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(db.query("select get_live_realized_sales('ALL')"),/authentication required/);
await compare('ALL');
// Downstream exceptions are still surfaced. This change is not an error-to-zero catch.
await db.exec("reset role;select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false)");
await db.exec(`create or replace function public.get_live_nav_reconciliation(text) returns jsonb language plpgsql stable as $$begin raise exception 'synthetic unavailable';end;$$`);
await assert.rejects(db.query("select get_live_period_stock_pnl('ALL')"),/synthetic unavailable/);
await assert.rejects(db.query("select get_live_realized_sales('ALL')"),/synthetic unavailable/);
await db.close();
if(process.env.OUTPUT)writeFileSync(process.env.OUTPUT,JSON.stringify({conditions:'Local PGlite; 3 securities/90 transactions, fixed 2026-11-09; NAV stub. Before is failure latency, NOT time to correct result. No speed claim.',checks,rows},null,2)+'\n');
console.log('Build258 empty collection/unknown/auth/upstream failure checks passed:',checks);
