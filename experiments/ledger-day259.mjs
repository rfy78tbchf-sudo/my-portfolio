import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {replaceLedger} from '../tests/fixtures/ledger259.mjs';
import {candidateSql} from './ledger-day-candidate259.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const raw=freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')),rows=[];
for(const total of [300,3000])for(const securities of [1,100]){
 if(total===300&&securities===100)continue;
 const db=await createRealizedFixture(securities);await replaceLedger(db,securities,total);
 await db.exec(freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')));
 await db.exec(raw);await db.exec(candidateSql(raw).replace('public.get_live_realized_sales(','public.candidate_realized_sales('));
 await db.exec('set role authenticated');
 for(const period of ['1W','1M','3M','ALL']){
 const expected=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;
 assert.deepEqual((await db.query('select candidate_realized_sales($1) r',[period])).rows[0].r,expected);
 for(let run=0;run<5;run++)for(const variant of(run%2?['candidate','baseline']:['baseline','candidate'])){
 const fn=variant==='candidate'?'candidate_realized_sales':'get_live_realized_sales',start=performance.now();
 const r=(await db.query('select '+fn+'($1) r',[period])).rows[0].r,ms=performance.now()-start;
 assert.deepEqual(r,expected);rows.push({securities,total,period,run,variant,ms});
 }
 console.error(total,securities,period,rows.slice(-2).map(x=>[x.variant,Math.round(x.ms)]));
 }
 await db.close();
}
writeFileSync('performance/ledger-day259.json',JSON.stringify({conditions:'PGlite current stock258/realized257 vs typed daily-record reuse; fixed2026-11-09; representative indexes; NAV stubbed; both SQL plans warm;5 alternating pairs per period/shape; all full responses equal. No browser/network timing.',rows},null,2)+'\n');
