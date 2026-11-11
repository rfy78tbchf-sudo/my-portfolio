import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const stepSource=html.slice(html.indexOf('  function detailNextStep('),html.indexOf('  function bindDetailNext('));
const bindingStart=html.indexOf('      bindDetailNext(active,function(){');
const bindingSource=html.slice(bindingStart,html.indexOf('      bindThesisPeriods();',bindingStart));

function fixture({saved=false,thesis=true}={}){
  const calls={ai:0,reason:0,save:0,close:0,retry:0,revealed:[]};
  const nodes=new Map([
    ['detailDecisionForm',{hidden:true,requestSubmit(){calls.save++}}],
    ['detailChoice',{value:'hold'}],
    ['detailReason',{value:'실적 변화 확인',focus(){}}],
    ['detailReview',{value:'다음 실적 발표',focus(){}}],
    ['detailDecisionReview',{id:'detailDecisionReview'}],
    ['detailDecisionSummary',{id:'detailDecisionSummary'}],
    ['detailFreshReview',{id:'detailFreshReview',disabled:false,click(){calls.ai++}}]
  ]);
  let binding;
  const context=vm.createContext({
    document:{getElementById:id=>nodes.get(id)||null},
    body:{querySelector:()=>null},active:()=>true,
    lastComparisonDirty:false,lastComparison:null,lastDetailAnalysisId:null,lastAnalysisComparison:false,
    pendingRetry:false,canRetryDecisionSubmission:()=>context.pendingRetry,decisionDraftValues:()=>({}),
    latestDecisionRows:saved?[{id:'saved-judgment'}]:[],thesisSaved:thesis,
    bindDetailNext(active,read,actions){binding={active,read,actions}},
    revealDetailTarget:node=>{if(node)calls.revealed.push(node.id)},
    openReasonEditor:()=>{calls.reason++},openDecisionForm:()=>{nodes.get('detailDecisionForm').hidden=false},
    closeSecurityDetail:()=>{calls.close++},retryDecisionHistory:()=>{calls.retry++}
  });
  vm.runInContext(stepSource+'\n'+bindingSource,context);
  return {calls,nodes,context,
    next(){return Array.from(context.detailNextStep(binding.read()))},
    click(){const [action]=this.next();binding.actions[action]?.()}
  };
}

// A next visit receives persisted rows through the real detail state reader.
const reopened=fixture({saved:true});
assert.deepEqual(reopened.next(),['review','지난 결정과 이후 변화 보기']);
assert.deepEqual(reopened.calls,{ai:0,reason:0,save:0,close:0,retry:0,revealed:[]},'reading the next action has no side effects');
reopened.click();
assert.deepEqual(reopened.calls,{ai:0,reason:0,save:0,close:0,retry:0,revealed:['detailDecisionReview']});
reopened.nodes.delete('detailDecisionReview');
reopened.click();
assert.equal(reopened.calls.revealed.at(-1),'detailDecisionSummary','saved content remains reachable before the review panel is available');

const noReason=fixture({thesis:false});
assert.deepEqual(noReason.next(),['reason','먼저 보유 이유 적기']);
noReason.click();
assert.equal(noReason.calls.reason,1);
assert.equal(noReason.calls.ai,0,'missing thesis is edited without attempting a model request');
noReason.context.latestDecisionRows=[{id:'existing-without-thesis'}];
assert.equal(noReason.next()[0],'review','an existing judgment can be reopened without adding a thesis');

// A new manual judgment remains possible without a thesis or an AI request.
noReason.nodes.get('detailDecisionForm').hidden=false;
assert.equal(noReason.next()[0],'save');
assert.equal(noReason.calls.save,0,'showing the save action does not submit');
noReason.click();
assert.equal(noReason.calls.save,1,'the explicit action uses the existing validated form submission');

const working=fixture({saved:true});
working.context.lastDetailAnalysisId='current-opinion';
assert.equal(working.next()[0],'compare','a current analysis keeps its next step ahead of saved history');
working.context.lastComparison={targetPct:15};
working.context.lastAnalysisComparison=true;
assert.equal(working.next()[0],'record');
working.nodes.get('detailDecisionForm').hidden=false;
assert.equal(working.next()[0],'save');
working.context.lastComparisonDirty=true;
assert.equal(working.next()[0],'compare','changed assumptions must be recalculated before saving');
working.context.body.querySelector=()=>({disabled:true});
assert.equal(working.next()[0],'busy');
working.context.body.querySelector=()=>null;
working.context.lastComparisonDirty=false;
working.nodes.set('detailDecisionDone',{id:'detailDecisionDone'});
working.nodes.get('detailDecisionForm').hidden=true;
assert.equal(working.next()[0],'done');
working.click();assert.equal(working.calls.close,1);

const unlinked=fixture({thesis:false});
unlinked.context.lastComparison={targetPct:15};
assert.equal(unlinked.next()[0],'reason','a comparison needing AI first obtains its required thesis');
unlinked.click();assert.equal(unlinked.calls.ai,0);
assert.equal(fixture().next()[0],'ai','the existing first-analysis path remains available');

const unavailable=fixture({thesis:false});unavailable.context.latestDecisionRows.unavailable=true;
assert.deepEqual(unavailable.next(),['retry','저장한 판단 다시 불러오기']);
unavailable.click();assert.equal(unavailable.calls.retry,1);
assert.equal(unavailable.calls.ai,0);assert.equal(unavailable.calls.reason,0);assert.equal(unavailable.calls.save,0);

// A restored comparison may be marked dirty only because calculation state was
// cleared. The same production pending predicate used by inline submit decides
// whether the footer may explicitly retry that original request.
const pending=fixture({saved:true});pending.nodes.get('detailDecisionForm').hidden=false;
pending.nodes.get('detailChoice').value='consider_reduction';pending.context.lastComparisonDirty=true;
pending.context.pendingRetry=true;
assert.deepEqual(pending.next(),['save','이전 판단 저장 재시도']);
assert.equal(pending.calls.save,0,'restoring a pending request never auto-submits');
pending.click();assert.equal(pending.calls.save,1,'pending footer uses the same validated form.requestSubmit path');
assert.equal(pending.calls.ai,0);assert.equal(pending.calls.retry,0,'save retry does not switch to history lookup or request AI');
pending.context.body.querySelector=()=>({disabled:true});
assert.equal(pending.next()[0],'busy','an in-flight operation keeps priority over pending retry');
pending.click();assert.equal(pending.calls.save,1);
pending.context.body.querySelector=()=>null;
pending.context.pendingRetry=false;
assert.equal(pending.next()[0],'compare','edited inputs or refreshed evidence keep existing comparison guards');
pending.context.pendingRetry=true;pending.nodes.get('detailDecisionForm').hidden=true;
assert.notEqual(pending.next()[0],'save','pending retry is offered only for the open draft');
pending.nodes.set('detailDecisionDone',{id:'detailDecisionDone'});
assert.equal(pending.next()[0],'done','a closed completed judgment still returns to the list');

const retryStart=html.indexOf('      async function retryDecisionHistory(){');
const retrySource=html.slice(retryStart,html.indexOf('      function savedComparisonAssumption(',retryStart));
function retryFixture(response){
  let pendingResponse=response;const calls={read:0,refresh:0,rendered:[],revealed:[]};
  const button={disabled:false,textContent:'',isConnected:true},form={hidden:true};
  const ctx=vm.createContext({
    active:()=>true,id:'saved-security',results:[],reviewRefreshFailed:true,decisionHistoryEpoch:0,decisionHistorySaving:false,d:{},p:[{close:10}],activity:{},
    document:{getElementById:id=>id==='detailDecisionRetry'?button:id==='detailDecisionForm'?form:{id}},
    rpc:async(name,args)=>{assert.equal(name,'get_investment_decisions');assert.equal(args.p_security_id,'saved-security');calls.read++;if(pendingResponse instanceof Error)throw pendingResponse;return pendingResponse},
    renderDecisionHistory:rows=>{calls.rendered.push(rows);button.disabled=false},
    refreshDecisionReview:()=>{calls.refresh++},revealDetailTarget:node=>calls.revealed.push(node.id)
  });
  vm.runInContext(retrySource,ctx);
  return {ctx,calls,button,form,setResponse:value=>{pendingResponse=value}};
}
const failed=retryFixture(Error('offline'));await failed.ctx.retryDecisionHistory();
assert.equal(failed.calls.read,1);assert.equal(failed.calls.rendered.at(-1).unavailable,true,'a failed retry remains unavailable instead of claiming empty history');
assert.equal(failed.calls.refresh,0);
failed.setResponse([{id:'saved-judgment',reason:'원래 이유',review_condition:'2026-12-01'}]);
await failed.ctx.retryDecisionHistory();
assert.equal(failed.calls.read,2);assert.equal(failed.calls.rendered.at(-1)[0].reason,'원래 이유');
assert.equal(failed.ctx.reviewRefreshFailed,false);assert.equal(failed.calls.refresh,1);
assert.deepEqual(failed.calls.revealed,['detailDecisionReview']);
const empty=retryFixture([]);await empty.ctx.retryDecisionHistory();
assert.equal(empty.calls.rendered.at(-1).unavailable,undefined,'only a successful empty response becomes a first decision');
const left=retryFixture([{id:'saved'}]);left.ctx.active=()=>false;await left.ctx.retryDecisionHistory();
assert.equal(left.calls.read,0);assert.equal(left.calls.rendered.length,0);
const drafting=retryFixture([{id:'saved'}]);drafting.form.hidden=false;await drafting.ctx.retryDecisionHistory();
assert.equal(drafting.calls.revealed.length,0,'a history retry does not move focus away from an open decision draft');

console.log('Build209/211: saved review, unavailable-history retry, thesis entry, explicit save, pending-save footer and next-action priority passed');
