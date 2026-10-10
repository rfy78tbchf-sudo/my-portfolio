import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Execute the production event handlers against isolated DOM/RPC doubles.
// No browser, network, account, or production writes are involved.
const html=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
const sources=[
  section('  function decisionConditionState(', '  function officialPeriodKo('),
  section('  function detailCurrentWeightHtml(', '  function decisionImpactHtml('),
  section('      function updateDecisionGuide(){',"      document.getElementById('detailChoice').addEventListener"),
  section("      ['detailWeightTarget','detailDown','detailUp'].forEach",'      var reviewAnalyses='),
  section("      var decisionForm=document.getElementById('detailDecisionForm');",'      var general='),
  section('      var scenarioClick=async function(kind){','      var pendingDetailRequest='),
  section('      var pendingDetailRequest=', '      if(analyze)analyze.onclick='),
  section("      var fresh=document.getElementById('detailFreshReview');if(fresh)fresh.onclick=",'      function bindThesisPeriods()')
].join('\n');
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function comparison(target=10){return {targetPct:target,downPct:-10,upPct:10,observationAt:'2026-09-26T12:10:00Z',result:{reduce:{shares_to_sell:5}}};}
function fixture(){
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{
    id,value:'',textContent:'',innerHTML:'',style:{},dataset:{},isConnected:true,disabled:false,hidden:false,children:[],listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn},appendChild(child){this.children.push(child)},insertBefore(){},
    insertAdjacentHTML(){},insertAdjacentElement(){},scrollIntoView(){},focus(){},remove(){},
    querySelector(selector){return selector.includes('submit')?element('submit'):null}
  });return elements.get(id);}
  const calls=[],rows=[];let request=0;
  const context={console,Number,Date,JSON,Promise,Error,Object,Array,String,
    document:{getElementById:element,querySelector:selector=>selector.includes('submit')?element('submit'):null,createElement:()=>element('created-'+Math.random())},
    window:{},crypto:{randomUUID:()=>`request-${++request}`},active:()=>true,id:'held',s:{symbol:'TEST'},
    choiceLabels:{hold:'현재 유지',revisit:'추가 확인 후 판단',consider_reduction:'일부 축소 검토',pause_addition:'추가매수 보류'},
    lastComparison:comparison(),lastComparisonDirty:false,lastDetailAnalysisId:'old-comparison-ai',lastAnalysisComparison:true,
    comparisonEpoch:0,analysisEpoch:0,decisionRequestId:null,decisionRequestKey:null,
    detailDirtyGroups:{detailDecisionForm:1},live:{reviewDecisions:[]},liveError:null,decisionHomeDirty:false,
    decisionDraftStore:()=>({}),removeDecisionDraft(){},clearDetailDirty(){},renderDecisionHistory(){},revealDetailTarget(){},closeSecurityDetail(){},showComparisonNext(){},
    comparisonHtml:()=>'<div class="choice-result-head">comparison</div>',
    thesisSaved:true,thesisVersion:1,analyze:element('thesisAnalyze'),general:element('detailAiGeneral'),
    edgeSync:async()=>{},loadLive:async()=>{},money:String,signedMoney:String,kstStamp:String,kstDate:()=> '2026-10-09',num:String,esc:String,
    finiteMetric:x=>x==null||x===''?NaN:Number(x),weightPct:x=>Number(x).toFixed(1)+'%',
    aiOfficialEvidence(){},aiSourceLinks(){},compactDetailAnswer(){},decisionImpactHtml:()=>'',
    loadThesisPrior(){},refreshDecisionReview(){},detailOpinionError:error=>error.message,
    requestDetailOpinion:async()=>({answer:'new opinion',analysis_id:'new-comparison-ai',history_saved:true}),
    async saveDecisionReceipt(args){calls.push(clone(args));const row={id:`saved-${calls.length}`,security_id:args.p_security_id,choice:args.p_choice,reason:args.p_reason,review_condition:args.p_review_condition,analysis_id:args.p_analysis_id,scenario_snapshot:{}};
      if(args.p_target_pct!==null)row.scenario_snapshot.choice_comparison={target_pct:args.p_target_pct,price_assumptions:{down_pct:args.p_down_pct,up_pct:args.p_up_pct},observation_at:args.p_observation_at,hold:{value_krw:10000},reduce:{mode:'integer_shares'}};
      rows.push(row);return {ok:true,id:row.id};},
    async rpc(name){if(name==='get_investment_decisions')return rows;
      if(name==='get_live_choice_comparison')return {ok:true,observation_at:'2026-09-26T12:10:00Z',denominator:{value:50000},reduce:{mode:'integer_shares',shares_to_sell:5}};
      if(name==='get_live_decision_metrics')return {ok:true};throw Error('Unexpected RPC '+name);}
  };
  const ctx=vm.createContext(context);vm.runInContext(sources,ctx);
  element('detailWeightTarget').value='10';element('detailDown').value='-10';element('detailUp').value='10';
  element('detailChoice').value='hold';element('detailReason').value='Keep my original reason';element('detailReview').value='Review next results';
  element('thesisAnalysis').textContent='old comparison opinion';
  const input=(id,value)=>{const node=element(id);node.value=value;node.listeners.input.call(node)};
  return {ctx,element,calls,rows,input,clear:()=>input('detailWeightTarget',''),submit:()=>element('detailDecisionForm').onsubmit({preventDefault(){}})};
}
function detached(f){assert.equal(f.ctx.lastComparison,null);assert.equal(f.ctx.lastComparisonDirty,false);assert.equal(f.ctx.lastDetailAnalysisId,null);assert.equal(f.ctx.lastAnalysisComparison,false);}
function plainWrite(f){assert.equal(f.calls.length,1);for(const field of ['p_analysis_id','p_target_pct','p_down_pct','p_up_pct','p_observation_at'])assert.equal(f.calls[0][field],null,field);assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);}

for(const choice of ['hold','revisit','pause_addition'])test(`cleared comparison saves plain ${choice} and preserves input`,async()=>{
  const f=fixture();f.element('detailChoice').value=choice;f.clear();detached(f);
  assert.equal(f.element('detailReason').value,'Keep my original reason');assert.equal(f.element('detailReview').value,'Review next results');assert.equal(f.element('detailChoice').value,choice);
  assert.match(f.element('detailChoiceGuide').textContent,/목표 비중 없이/);await f.submit();plainWrite(f);
});
test('clearing after a dirty edit detaches; reduction still requires comparison',async()=>{
  const f=fixture();f.input('detailDown','-20');assert.equal(f.ctx.lastComparisonDirty,true);f.clear();detached(f);
  f.element('detailChoice').value='consider_reduction';await f.submit();assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/수량 비교/);
});
for(const [id,value] of [['detailWeightTarget','12'],['detailDown','-20'],['detailUp','20']])test(`nonblank ${id} changes retain the recalculation guard`,async()=>{
  const f=fixture();f.input(id,value);await f.submit();assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/다시 비교/);
});
test('zero target is a real comparison and still needs current AI',async()=>{
  const f=fixture();f.input('detailWeightTarget','0');assert.notEqual(f.ctx.lastComparison,null);assert.equal(f.ctx.lastComparisonDirty,true);
  f.ctx.lastComparison=comparison(0);f.ctx.lastComparisonDirty=false;f.element('detailChoice').value='consider_reduction';await f.submit();assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/AI 의견/);
  f.ctx.lastDetailAnalysisId='zero-ai';f.ctx.lastAnalysisComparison=true;await f.submit();assert.equal(f.calls[0].p_target_pct,0);assert.equal(f.calls[0].p_analysis_id,'zero-ai');assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);
});
test('already blank target preserves a standalone AI opinion',async()=>{
  const f=fixture();f.ctx.lastComparison=null;f.ctx.lastAnalysisComparison=false;f.ctx.lastDetailAnalysisId='standalone-ai';f.element('thesisAnalysis').textContent='standalone opinion';f.clear();
  assert.equal(f.ctx.lastDetailAnalysisId,'standalone-ai');assert.equal(f.element('thesisAnalysis').textContent,'standalone opinion');assert.equal(f.ctx.analysisEpoch,0);
  await f.submit();assert.equal(f.calls[0].p_analysis_id,'standalone-ai');
});
for(const rejected of [false,true])test(`clear invalidates pending comparison ${rejected?'failure':'success'}`,async()=>{
  const f=fixture(),pending=deferred();f.ctx.rpc=()=>pending.promise;const work=f.ctx.scenarioClick('weight');f.clear();
  const message=f.element('detailWeightResult').textContent;if(rejected)pending.reject(Error('old calculation failed'));else pending.resolve({ok:true});await work;
  assert.equal(f.ctx.lastComparison,null);assert.equal(f.element('detailWeightResult').textContent,message);assert.equal(f.element('detailWeightRun').disabled,false);
});
for(const rejected of [false,true])test(`clear invalidates pending fresh refresh ${rejected?'failure':'success'}`,async()=>{
  const f=fixture(),pending=deferred();f.ctx.edgeSync=()=>pending.promise;const work=f.element('detailFreshReview').onclick();f.clear();const message=f.element('detailWeightResult').textContent;
  if(rejected)pending.reject(Error('old refresh failed'));else pending.resolve();await work;detached(f);
  assert.equal(f.element('detailWeightResult').textContent,message);assert.equal(f.element('detailFreshStatus').textContent,'');assert.equal(f.element('detailFreshReview').disabled,false);
});
for(const rejected of [false,true])test(`clearing invalidates pending comparison AI ${rejected?'failure':'success'}`,async()=>{
  const f=fixture(),pending=deferred();f.ctx.requestDetailOpinion=()=>pending.promise;const work=f.ctx.runDetailAnalysis(true,true,f.ctx.lastComparison);f.clear();const message=f.element('thesisAnalysis').textContent;
  if(rejected)pending.reject(Error('old AI failed'));else pending.resolve({answer:'stale answer',analysis_id:'stale-ai',history_saved:true});await work;detached(f);assert.equal(f.element('thesisAnalysis').textContent,message);await f.submit();plainWrite(f);
});
test('pending comparison AI is invalidated even if recalculation removed its snapshot',async()=>{
  const f=fixture(),pending=deferred();f.ctx.lastAnalysisComparison=false;f.ctx.requestDetailOpinion=()=>pending.promise;const work=f.ctx.runDetailAnalysis(true,true,f.ctx.lastComparison);
  f.ctx.lastComparison=null;f.clear();pending.resolve({answer:'stale answer',analysis_id:'stale-ai',history_saved:true});await work;detached(f);
});
test('clearing during submitted comparison save verifies the submitted receipt',async()=>{
  const f=fixture(),pending=deferred(),save=f.ctx.saveDecisionReceipt;f.ctx.saveDecisionReceipt=async args=>{const receipt=await save(args);await pending.promise;return receipt};
  const work=f.submit();f.clear();pending.resolve();await work;assert.equal(f.calls[0].p_analysis_id,'old-comparison-ai');assert.equal(f.calls[0].p_target_pct,10);assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);detached(f);
});
test('clear then compare and analyze again links only the new comparison',async()=>{
  const f=fixture();f.clear();f.input('detailWeightTarget','5');await f.ctx.scenarioClick('weight');await f.ctx.runDetailAnalysis(true,true,f.ctx.lastComparison);await f.submit();
  assert.equal(f.calls[0].p_target_pct,5);assert.equal(f.calls[0].p_analysis_id,'new-comparison-ai');assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);
});
test('receipt mismatch still fails rather than treating a write as verified',async()=>{
  const f=fixture();f.clear();const rpc=f.ctx.rpc;f.ctx.rpc=async(name,args)=>{const rows=await rpc(name,args);if(name==='get_investment_decisions')return rows.map(row=>({...row,analysis_id:'unexpected-ai'}));return rows};
  await f.submit();assert.equal(f.calls.length,1);assert.match(f.element('detailDecisionStatus').textContent,/저장 실패/);assert.equal(f.element('detailDecisionForm').hidden,false);
});
test('clearing the first pending fresh comparison removes its loading opinion',async()=>{
  const f=fixture(),pending=deferred();f.ctx.lastComparison=null;f.ctx.lastDetailAnalysisId=null;f.ctx.lastAnalysisComparison=false;f.ctx.edgeSync=()=>pending.promise;
  const work=f.element('detailFreshReview').onclick();f.clear();const message=f.element('thesisAnalysis').textContent;
  assert.match(message,/연결하지 않습니다/);pending.resolve();await work;detached(f);assert.equal(f.element('thesisAnalysis').textContent,message);await f.submit();plainWrite(f);
});
