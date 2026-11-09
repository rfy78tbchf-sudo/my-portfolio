import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {replaceLedger} from '../tests/fixtures/ledger259.mjs';
import {candidateSql} from './closed-opening-candidate260.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const raw=freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')),rows=[];
for(const [total,securities] of [[300,1],[3000,1],[3000,100]]){
 const db=await createRealizedFixture(securities);await replaceLedger(db,securities,total);
 await db.exec(raw);await db.exec(candidateSql(raw).replace('public.get_live_period_stock_pnl(','public.candidate_stock_pnl('));
 await db.exec('set role authenticated');
 for(const period of ['1W','1M','3M','ALL']){
 const expected=(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r;
 assert.deepEqual((await db.query('select candidate_stock_pnl($1) r',[period])).rows[0].r,expected);
 for(let run=0;run<5;run++)for(const variant of(run%2?['candidate','baseline']:['baseline','candidate'])){
 const fn=variant==='candidate'?'candidate_stock_pnl':'get_live_period_stock_pnl',start=performance.now();
 const r=(await db.query('select '+fn+'($1) r',[period])).rows[0].r,ms=performance.now()-start;assert.deepEqual(r,expected);rows.push({total,securities,period,run,variant,ms});
 }
 console.error(total,securities,period,rows.slice(-2).map(x=>[x.variant,Math.round(x.ms)]));
 }
 await db.close();
}
writeFileSync('performance/closed-opening260.json',JSON.stringify({conditions:'Isolated candidate; current stock258 vs same-statement grouped pre-start quantity. Fixed2026-11-09; PGlite; NAVstub; representative indexes;5 alternating pairs/period/shape; both plans warm; all full results equal. No browser/prod timings.',rows},null,2)+'\n');
