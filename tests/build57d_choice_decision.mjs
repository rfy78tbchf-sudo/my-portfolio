import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Private holdings are never used as a fixture or written by this test.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build57d_decisions.sql',import.meta.url),'utf8');
const backend=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const from=html.indexOf('  function comparisonHtml('),to=html.indexOf('  function aiSourceLinks(',from);
assert.ok(from>0&&to>from);
const context=vm.createContext({money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>(Number(n)>0?'+':'')+Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  num:(n,d)=>Number(n).toFixed(d),esc:String,kstStamp:x=>String(x)});
vm.runInContext(html.slice(from,to),context);
const report={ok:true,hold:{value_krw:10000,quantity:10,weight_pct:20,
  down_impact_krw:-1000,up_impact_krw:1000},
  reduce:{value_krw:5000,quantity_reference:5,weight_pct:10,cash_increase_krw:5000,
    down_impact_krw:-500,up_impact_krw:500},
  price_assumptions:{down_pct:-10,up_pct:10},current_cash_kb_krw:null,
  assets_before_krw:50000,observation_at:'test-basis'};
const rendered=vm.runInContext('comparisonHtml(report)',Object.assign(context,{report}));
assert.match(rendered,/10,000원/);
assert.match(rendered,/5,000원/);
assert.match(rendered,/-1,000원/);
assert.match(rendered,/\+1,000원/);
assert.match(rendered,/\-500원/);
assert.match(rendered,/\+500원/);
assert.match(rendered,/현재 현금 잔액은 확인되지 않아 증가분만 표시/);
assert.match(rendered,/매도 대금은 새 수익이나 외부 입금이 아닙니다/);
assert.match(html,/rpc\('get_live_choice_comparison'/);
assert.match(html,/detailDecisionForm/);
assert.match(html,/rpc\('save_investment_decision'/);
assert.match(html,/general\.onclick=function\(\)\{runDetailAnalysis\(false\)\}/);
assert.match(html,/lastDetailAnalysisId=x\.analysis_id/);
assert.match(sql,/investment_decisions_owner_insert[\s\S]*auth\.uid\(\)/);
assert.match(sql,/security invoker/);
assert.match(sql,/v_after\*p_down_pct\/100/);
assert.match(sql,/v_after\*p_up_pct\/100/);
assert.match(sql,/assets_after_before_cost_krw',v_assets/);
assert.match(backend,/get_live_choice_comparison/);
assert.match(backend,/publicEvidence\?\.sources\|\|\[\]/);
console.log('Choice comparison shows both price directions, stable assets, and owner-only judgment storage');
