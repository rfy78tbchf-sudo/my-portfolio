import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Private holdings are never used as a fixture or written by this test.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build57d_decisions.sql',import.meta.url),'utf8');
const comparisonSave=readFileSync(new URL('../supabase/build58c_decision_comparison.sql',import.meta.url),'utf8');
const backend=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const from=html.indexOf('  function comparisonHtml('),to=html.indexOf('  function aiSourceLinks(',from);
assert.ok(from>0&&to>from);
const context=vm.createContext({money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>(Number(n)>0?'+':'')+Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  num:(n,d)=>Number(n).toFixed(d),esc:String,kstStamp:x=>String(x),finiteMetric:n=>n==null?NaN:Number(n),cls:n=>Number(n)>=0?'up':'down'});
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
assert.match(rendered,/줄이면 하락 영향은 500원 작아지고, 상승 참여도 500원 줄어듭니다/);
assert.match(rendered,/매도대금의 원화 환산액\(참고\)/);
context.report={...report,position_currency:'USD',current_cash_kb_krw:400};
const dollarCash=vm.runInContext('comparisonHtml(report)',context);
assert.match(dollarCash,/USD 현금 보유 가정/);
assert.match(dollarCash,/환율 노출은 남습니다/);
assert.match(dollarCash,/매도대금이 원화로 입금된다는 뜻은 아닙니다/);
assert.match(rendered,/<details><summary>수량·금액과 계산 기준 보기<\/summary>/);
assert.match(rendered,/현재 현금 잔액은 확인되지 않아 증가분만 표시/);
assert.match(rendered,/매도 대금은 새 수익이나 외부 입금이 아닙니다/);
assert.match(vm.runInContext('comparisonHtml({...report,reduce:{...report.reduce,up_impact_krw:null}})',context),/다시 계산해 주세요/,
  'incomplete gains cannot be displayed as a finished choice comparison');
const down={ok:true,observation_at:'same-account-cut',position:{symbol:'TEST',value:10000},scenario:{assumption_pct:-10,impact_krw:-1000}},
  up={ok:true,observation_at:'same-account-cut',position:{symbol:'TEST',value:10000},scenario:{assumption_pct:10,impact_krw:1000}};
const impact=vm.runInContext('decisionImpactHtml(down,up,"TEST")',Object.assign(context,{down,up}));
assert.match(impact,/−10%라면.*-1,000원/s);
assert.match(impact,/\+10%라면.*\+1,000원/s);
assert.match(impact,/다른 자산·환율 고정/);
assert.equal(vm.runInContext('decisionImpactHtml(down,up,"OTHER")',context),'',
  'a different holding cannot inherit this security’s sensitivity');
assert.equal(vm.runInContext('decisionImpactHtml(down,{...up,observation_at:"old"},"TEST")',context),'',
  'different observation times cannot form a single comparison');
assert.equal(vm.runInContext('decisionImpactHtml(down,{...up,scenario:{assumption_pct:10,impact_krw:5000}},"TEST")',context),'',
  'miscalculated impacts must not be presented as account evidence');
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
assert.match(comparisonSave,/v_comparison:=public\.get_live_choice_comparison\(v_symbol,p_target_pct,p_down_pct,p_up_pct\)/);
assert.match(comparisonSave,/observation_at'\)::timestamptz is distinct from p_observation_at/);
assert.match(comparisonSave,/d\.user_id=v_user/);
assert.doesNotMatch(comparisonSave,/insert into public\.(?:transactions|cash_flows)/i);
assert.match(html,/p_target_pct:lastComparison\.targetPct/);
assert.match(html,/lastComparison=\{targetPct:value,downPct:down,upPct:up,observationAt:data\.observation_at\}/);
assert.match(backend,/get_live_choice_comparison/);
assert.match(backend,/publicEvidence\?\.sources\|\|\[\]/);
console.log('Choice comparison shows both price directions, stable assets, and owner-only judgment storage');
