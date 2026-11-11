// Rejected-candidate evaluation only; no production connection or persistent cache.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const rows=[];let failureChecks=0;
for(const size of [10,100]){
 const db=await createRealizedFixture(size);
 await db.exec(freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')));
 const original=freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8'));
 await db.exec(original);
 const signature="public.get_live_realized_sales(p_period text DEFAULT '1M'::text, p_account uuid DEFAULT NULL::uuid)";
 const line="v_period:=public.get_live_period_stock_pnl(case when p_period='TODAY' then '오늘' else p_period end);";
 assert.ok(original.includes(signature)&&original.includes(line));
 const shared=original.replace(signature,'public.diagnostic_shared_realized(p_period text, p_account uuid, p_stock jsonb)').replace(line,'v_period:=p_stock;');
 await db.exec(shared);
 await db.exec(`create function diagnostic_combined(p text) returns jsonb language sql stable as $$
 with stock as materialized (select get_live_period_stock_pnl(p) data)
 select jsonb_build_object('stock',data,'realized',diagnostic_shared_realized(p,null,data)) from stock $$;set role authenticated;`);
 for(const period of ['1W','1M','3M','ALL']){
  const expected={stock:(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r,realized:(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r};
  assert.deepEqual((await db.query('select diagnostic_combined($1) r',[period])).rows[0].r,expected);
  for(let run=0;run<5;run++)for(const variant of(run%2?['combined','separate']:['separate','combined'])){
   const start=performance.now();let value,first;
   if(variant==='separate'){
    const stock=(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r;first=performance.now()-start;
    value={stock,realized:(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r};
   }else{value=(await db.query('select diagnostic_combined($1) r',[period])).rows[0].r;first=performance.now()-start;}
   const complete=performance.now()-start;assert.deepEqual(value,expected);
   rows.push({transactions:size*30,period,run,variant,firstTotalMs:first,bothResultsMs:complete});
  }
  console.error(size,period,'passed complete output equality');
 }
 await db.exec(`reset role;create or replace function diagnostic_shared_realized(p_period text,p_account uuid,p_stock jsonb) returns jsonb language plpgsql stable as $$begin raise exception 'synthetic realized failure';end;$$;set role authenticated;`);
 assert.equal((await db.query("select get_live_period_stock_pnl('1W') r")).rows[0].r.ok,true);
 await assert.rejects(db.query("select diagnostic_combined('1W')"),/synthetic realized failure/);failureChecks++;
 await db.close();
}
writeFileSync('performance/combined-period259.json',JSON.stringify({conditions:'PGlite, fixed2026-11-09, actual deployed stock258/realized257 functions; NAV stubbed as in fixture257; 300/3000 synthetic transactions; both SQL plans warmed; five alternating pairs per period; no network/browser. FirstTotalMs is availability of the total result, NOT browser paint. No live writes or persistent cross-request caching.',decision:'Do not deploy monolithic combined response: first total waits for realized work and realized failure discards otherwise successful total.',failureChecks,rows},null,2)+'\n');
