import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const worker=readFileSync(new URL('../supabase/functions/kb-sync-worker/index.ts',import.meta.url),'utf8');
const start=worker.indexOf('function isoDate8(');
const end=worker.indexOf('async function domesticChart(',start);
assert.ok(start>0&&end>start);
const snippet=stripTypeScriptTypes(worker.slice(start,end));
const rows=[{dt:'20260928',cls_prc_p4:'302.50',cls_prc_p2:'302.50',vlm:'53982'},
  {dt:'20260925',cls_prc_p4:'310.32',cls_prc_p2:'310.32',vlm:'300000'}];
function at(iso,kind){
  const instant=new Date(iso);
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[instant.valueOf()]))} static now(){return instant.valueOf()}}
  const scope=vm.createContext({Date:FixedDate,Intl,Object,Number,String,
    nOrNull:v=>v==null?null:Number(v)});
  vm.runInContext(snippet,scope);
  scope.rows=rows;scope.kind=kind;
  return Array.from(vm.runInContext("normalizeChartRows('synthetic-security','USD',rows,kind)",scope));
}
assert.deepEqual(at('2026-09-28T02:45:49Z','overseas').map(r=>r.price_date),['2026-09-25'],
  'Monday chart row returned on Sunday New York time is not a daily close');
assert.deepEqual(at('2026-09-28T02:45:49Z','domestic').map(r=>r.price_date),['2026-09-25'],
  'today in Seoul before the KRX close is not a daily close');
assert.deepEqual(at('2026-09-28T20:14:00Z','overseas').map(r=>r.price_date),['2026-09-25']);
assert.deepEqual(at('2026-09-28T20:16:00Z','overseas').map(r=>r.price_date),
  ['2026-09-28','2026-09-25'],'after the full session a new close may be stored');
const sql=readFileSync(new URL('../supabase/build64a_unconfirmed_daily_close.sql',import.meta.url),'utf8');
assert.match(sql,/last_completed_close_date\(s.market,obs.as_of\)/);
assert.match(sql,/unconfirmed_daily_closes/);
assert.match(sql,/analysis used an unconfirmed close/);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/지난 분석은 당시 확정되지 않은 종가를 근거로 사용했습니다/);
assert.match(html,/계좌 평가액 기준 원화 상당액/);
console.log('Unconfirmed KB daily rows remain out of market prices, AI history is marked, and past answers cannot anchor decisions');
