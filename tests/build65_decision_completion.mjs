import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build65_decision_completion.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const start=html.indexOf('      function matchingAnalysis()');
const end=html.indexOf('      function showComparisonNext()',start);
assert.ok(start>0&&end>start);
const current={ok:true,exact_target:{target_pct:10},price_assumptions:{down_pct:-10,up_pct:10},
  denominator:{value:50000},hold:{value_krw:10000,quantity:10},
  reduce:{shares_to_sell:5,cash_increase_krw:5000}};
const history={id:'saved-10',response_kind:'model_interpretation_server_metrics',thesis_version:2,
  comparison_evidence:{target_pct:10,price_assumptions:{down_pct:-10,up_pct:10},
    reduce:{shares_to_sell:5,cash_increase_krw:5000}},
  account_basis:{position_value_krw:10000,denominator_value_krw:50000,quantity:10},
  price_evidence:{price_date:'2026-09-25',latest_close:300}};
const scope={breakoutReady:true,lastComparison:{targetPct:10,downPct:-10,upPct:10,result:current},
  lastComparisonDirty:false,recentAnalyses:[history],thesisVersion:2,
  document:{getElementById:()=>({dataset:{}})},p:[{date:'2026-09-25',close:300}]};
vm.createContext(scope);vm.runInContext(html.slice(start,end),scope);
assert.equal(vm.runInContext('matchingAnalysis()?.id',scope),'saved-10');
scope.recentAnalyses=[{...history,id:'old-15',comparison_evidence:{...history.comparison_evidence,target_pct:15}}];
assert.equal(vm.runInContext('matchingAnalysis()',scope),null,'old 15% never becomes the 10% AI opinion');
scope.recentAnalyses=[history];scope.lastComparison={...scope.lastComparison,downPct:-9};
assert.equal(vm.runInContext('matchingAnalysis()',scope),null,'price changes invalidate reuse');
scope.lastComparison={...scope.lastComparison,downPct:-10};scope.thesisVersion=3;
assert.equal(vm.runInContext('matchingAnalysis()',scope),null,'thesis version changes invalidate reuse');
scope.thesisVersion=2;scope.p=[{date:'2026-09-26',close:290}];
assert.equal(vm.runInContext('matchingAnalysis()',scope),null,'new price evidence invalidates reuse');
assert.match(sql,/p_choice='consider_reduction' then raise exception 'complete comparison required'/);
assert.match(sql,/return public\.save_investment_decision\(p_security_id,p_choice,p_reason/);
assert.match(sql,/d\.scenario_snapshot \? 'choice_comparison'/);
assert.match(sql,/v_history\.comparison_evidence->>'target_pct'\)::numeric is distinct from p_target_pct/);
assert.match(sql,/d\.id,d\.security_id,d\.choice/);
assert.match(edge,/code:'REQUEST_CONTEXT_CHANGED'/);
console.log('Exact comparison AI reuse, old assumption isolation, and optional atomic save verified');
