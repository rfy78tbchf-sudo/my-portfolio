// Follow-up hypothesis: identify remaining stock SQL work, using synthetic rows only.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {replaceLedger} from '../tests/fixtures/ledger259.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const db=await createRealizedFixture(100);await replaceLedger(db,100,3000);
const sql=readFileSync('supabase/build258_empty_period_items.sql','utf8').split('$function$')[1].replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec('set role authenticated;set jit=off;set work_mem=\'16MB\'');
function summarize(plan){const top=plan[0],nodes=[];
 function walk(n,path){path=[...path,n['Subplan Name']||n['CTE Name']||n['Node Type']];const row={...n};delete row.Plans;delete row.Output;row.path=path;row.inclusiveAllLoopsMs=(n['Actual Total Time']||0)*(n['Actual Loops']||0);nodes.push(row);for(const c of n.Plans||[])walk(c,path)}
 walk(top.Plan,[]);return {executionMs:top['Execution Time'],planningMs:top['Planning Time'],topInclusiveNodes:nodes.sort((a,b)=>b.inclusiveAllLoopsMs-a.inclusiveAllLoopsMs).slice(0,32),...(process.env.FULL_PLAN?{plan}:{})};}
const rows=[];
for(const period of ['1W','ALL']){
 const body=sql.replaceAll('p_period',"'"+period+"'::text");
 await db.query(body);
 for(let run=0;run<3;run++){
 const plan=(await db.query('explain (analyze,buffers,format json) '+body)).rows[0]['QUERY PLAN'];rows.push({period,run,...summarize(plan)});
 }
}
await db.close();writeFileSync('performance/stock-plan259.json',JSON.stringify({conditions:'Post-change follow-up, unchanged stock258 SQL expanded outside the SQL function for EXPLAIN;100 securities×30daily trades;PGlite;NAVstub;3warm plans per period. Instrumentation changes overhead; top32 node times are inclusive and overlap (do not sum); FULL_PLAN=1 includes complete plans. This is not a before/after improvement.',rows})+'\n');
