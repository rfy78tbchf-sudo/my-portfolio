import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sql=readFileSync(new URL('../supabase/build50_decision_metrics.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const ai=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(sql,/where a\.user_id=\(select auth\.uid\(\)\)/);
assert.match(sql,/as_of is distinct from v_as_of/);
assert.match(sql,/v_position\*p_change_pct\/100/);
assert.match(sql,/broker_account_overlap_verified/);
assert.match(edge,/confidence:context\.confidence==='confirmed'\?'confirmed'/,
  'history confidence must satisfy the real database constraint');
assert.doesNotMatch(edge,/ai_analysis_history'[\s\S]{0,900}\.catch\(\(\)=>null\)/,
  'history failures must never be swallowed');
assert.match(html,/id="thesisAnalyze"/);
assert.match(html,/if\(requireThesis&&!thesisSaved\)/,'thesis review requires a saved thesis, general review remains available');
assert.match(html,/thesisVersion=Number\(updated&&updated\.thesis&&updated\.thesis\.version\|\|0\)/);
assert.match(html,/thesisSaved=thesisVersion>0/);
assert.match(html,/top1=alignedMetrics\?Number\(live\.decisionMetrics\.position\.weight_pct\)/,
  'analysis uses the same observation and denominator as the risk card');

// Exercise the shipping scenario UI with synthetic figures and the actual RPC payload.
const inputs={scenarioSymbol:{value:'ARM'},scenarioChange:{value:'-10'},
  scenarioRun:{disabled:false},scenarioResult:{textContent:''}};
const request=[];
const context={supabaseUrl:'https://example.invalid',publicKey:'test-publishable',
  authFetch:async (_url,options)=>{
    request.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({ok:true,
      observation_at:'2026-01-02T00:00:00Z',
      position:{symbol:'ARM',value:15000000},
      denominator:{value:60000000,kb_response_value:51000000,manual_overlay:9000000,primary_observed_at:'2026-01-02T00:00:00Z',isa_captured_at:'2026-01-01T23:30:00Z'},
      scenario:{impact_krw:-1500000,asset_impact_pct:-2.5}})};
  }};
const begin=ai.indexOf('  async function runScenario()');
const end=ai.indexOf('  async function loadPrevious(',begin);
assert.ok(begin>0&&end>begin);
const box=vm.createContext({context,document:{getElementById:(id)=>inputs[id]},Number,Intl,Date,Error});
vm.runInContext(ai.slice(begin,end),box);
await vm.runInContext('runScenario()',box);
assert.equal(request.length,1);
assert.equal(request[0].action,'scenario');
assert.equal(request[0].change_pct,-10);
assert.match(inputs.scenarioResult.textContent,/-1,500,000원/);
assert.match(inputs.scenarioResult.textContent,/계좌 식별자 연결은 미확인/);
assert.match(inputs.scenarioResult.textContent,/예측이 아닙니다/);
context.authFetch=async()=>({ok:true,json:async()=>({ok:true,
  observation_at:'2026-01-02T00:00:00Z',account_scope_state:'verified',
  position:{symbol:'ARM',value:15000000},
  denominator:{value:60000000,kb_response_value:51000000,manual_overlay:9000000,primary_observed_at:'2026-01-02T00:00:00Z',isa_captured_at:'2026-01-01T23:30:00Z'},
  scenario:{impact_krw:-1500000,asset_impact_pct:-2.5}})});
await vm.runInContext('runScenario()',box);
assert.match(inputs.scenarioResult.textContent,/ISA 관측/);
assert.match(inputs.scenarioResult.textContent,/계좌 식별자 연결은 미확인/);
inputs.scenarioChange.value='-120';
await vm.runInContext('runScenario()',box);
assert.equal(request.length,1,'invalid change cannot call the server');
console.log('build50 decision provenance, scenario rendering, history gate passed');
