// Whole local Node/PGlite process peak RSS; not operating Postgres memory.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {replaceLedger} from '../tests/fixtures/ledger259.mjs';
if(process.env.MEMORY_VARIANT){
 const db=await createRealizedFixture(100),variant=process.env.MEMORY_VARIANT;
 await replaceLedger(db,100,3000);
 const path=variant==='baseline'?'supabase/build258_empty_period_items.sql':'supabase/build260_closed_opening_quantity.sql';
 await db.exec(readFileSync(path,'utf8').replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));
 await db.exec(readFileSync('supabase/build259_daily_realized_records.sql','utf8').replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));
 await db.exec('set role authenticated');global.gc();
 const initialRss=process.memoryUsage().rss,checkpoints=[];let hash;
 for(let n=0;n<5;n++){
  const r=(await db.query("select get_live_realized_sales('ALL') r")).rows[0].r;
  const h=createHash('sha256').update(JSON.stringify(r)).digest('hex');if(hash)assert.equal(h,hash);hash=h;
  global.gc();checkpoints.push({n,peakRssBytes:process.resourceUsage().maxRSS*1024,rssBytes:process.memoryUsage().rss,heapUsed:process.memoryUsage().heapUsed});
 }
 await db.close();console.log(JSON.stringify({variant,initialRss,hash,checkpoints}));
}else{
 const rows=[];for(let pair=0;pair<3;pair++)for(const variant of(pair%2?['candidate','baseline']:['baseline','candidate'])){
  const r=JSON.parse(execFileSync(process.execPath,['--expose-gc',new URL(import.meta.url).pathname],{env:{...process.env,MEMORY_VARIANT:variant},encoding:'utf8',maxBuffer:1000000}));
  rows.push({pair,...r});console.error(pair,variant,r.checkpoints.at(-1).peakRssBytes);
 }
 assert.equal(new Set(rows.map(r=>r.hash)).size,1,'full result equality across fresh processes');
 writeFileSync('performance/closed-memory260.json',JSON.stringify({conditions:{database:'isolated local PGlite, NAV stubbed',transactions:3000,sales:1500,period:'ALL',freshProcesses:6,queriesPerProcess:5,metric:'Linux process maximum resident set size; includes Node/WASM/fixture setup, not a production Postgres limit'},rows},null,2)+'\n');
}
