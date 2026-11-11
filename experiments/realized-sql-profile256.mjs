// Local synthetic phase attribution only; no production connection or source mutation.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {candidateSql} from './realized-array-candidate256.mjs';
const rows=[];
for(const size of [10,100]){
 const db=await createRealizedFixture(size);
 const raw=readFileSync('supabase/migrations/20261104045000_reconcile_settlement_precision.sql','utf8').replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
 await db.exec(raw);
 let profile=(process.env.CANDIDATE?candidateSql(raw):raw).replace('public.get_live_realized_sales(','public.diagnostic_realized_sales(').replace('declare\n',"declare\n  diagnostic_at timestamptz := clock_timestamp(); diagnostic_stock_at timestamptz; diagnostic_phases jsonb := '{}';\n");
 const boundaries=[
 ['  -- BEGIN recovered-date projection','account'],
 ['  for v_security in','dates'],
 ['  -- Execution evidence is visible','ledger'],
 ['  -- Prefer an independently reconciled','pending'],
 ['  -- Aggregate fully closed periods','official'],
 ['  -- Build245','closed']
 ];
 // Final two anchors resolved from current SQL rather than assuming comment spelling.
 boundaries.pop();
 const estimateAt=profile.indexOf('  with candidates as');
 if(estimateAt<0)throw Error('estimate anchor drift');
 boundaries.push([profile.slice(estimateAt,estimateAt+21),'closed']);
 for(const [anchor,label] of boundaries){if(!profile.includes(anchor))throw Error('phase anchor drift '+label);profile=profile.replace(anchor,`  diagnostic_phases:=diagnostic_phases||jsonb_build_object('${label}',extract(epoch from clock_timestamp()-diagnostic_at)*1000);diagnostic_at:=clock_timestamp();\n`+anchor)}
 profile=profile.replace("  return jsonb_build_object('ok',true",`  diagnostic_phases:=diagnostic_phases||jsonb_build_object('estimates',extract(epoch from clock_timestamp()-diagnostic_at)*1000);\n  return jsonb_build_object('_diagnostic_ms',diagnostic_phases,'ok',true`);
 const stockLine="    v_period:=public.get_live_period_stock_pnl(case when p_period='TODAY' then '오늘' else p_period end);";
 assert.ok(profile.includes(stockLine));
 profile=profile.replace(stockLine,"    diagnostic_stock_at:=clock_timestamp();\n"+stockLine+"\n    diagnostic_phases:=diagnostic_phases||jsonb_build_object('stock_subcall',extract(epoch from clock_timestamp()-diagnostic_stock_at)*1000);");
 await db.exec(profile);await db.exec('set role authenticated');
 for(const period of ['1W','1M','3M','ALL']){
  const expected=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;
  for(let run=0;run<5;run++){
   const t=performance.now(),result=(await db.query('select diagnostic_realized_sales($1) r',[period])).rows[0].r;
   const ms=performance.now()-t,phases=result._diagnostic_ms;delete result._diagnostic_ms;
   assert.deepEqual(result,expected,'instrumentation preserves complete RPC output');
   rows.push({size,transactions:size*30,period,run,ms,phases,sales:result.items.length});console.error(JSON.stringify({size,period,run,ms:Math.round(ms)}));
  }
 }
 await db.close();
}
writeFileSync(process.env.OUTPUT||'performance/realized-sql-profile256.json',JSON.stringify({candidate:!!process.env.CANDIDATE,conditions:{database:'PGlite',nav:'stubbed/excluded',time:'2026-11-09T12:00:00+09:00',network:'none',fixture:'USD alternating buys/sells, 30 transactions per security; empty observation/domestic/pending tables',indexes:'representative production lookup indexes; no production data'},rows},null,2)+'\n');
console.log('phase profile saved; all complete outputs matched uninstrumented SQL');
