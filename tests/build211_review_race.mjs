import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Run real history/draft/submit handlers with synthetic DOM and RPC boundaries.
// No account, broker, production database or model request is used.
const html=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
const source=[
  section('  function decisionConditionState(', '  function officialPeriodKo('),
  section('  var decisionDraftOwner=', '  function closeSecurityDetail('),
  section('    body.oninput=', "    modal.querySelector('.detail-sheet').scrollTop=0"),
  section('  function decisionFollowupDraft(', '  function decisionReviewHtml('),
  section('      function updateDecisionGuide(){', '      function matchingAnalysis('),
  section('      var reviewAnalyses=', '      if(reviewEntry)revealDetailTarget'),
  section('      var refreshDecisionReview=', '      if(Array.isArray(results[3])&&results[3].length)refreshDecisionReview();'),
  section("      var decisionForm=document.getElementById('detailDecisionForm');",'      var general=')
].join('\n');
const sql=readFileSync(new URL('../supabase/build211_decision_request_readback.sql',import.meta.url),'utf8');
const projection=sql.match(/from \(select ([\s\S]*?) from public\.investment_decisions d/);
assert.ok(projection,'real getter projection');
const fields=[...projection[1].matchAll(/d\.([a-z_]+)/g)].map(match=>match[1]);
const clone=value=>JSON.parse(JSON.stringify(value));
const project=rows=>clone(rows.map(row=>Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function prior(){return {id:'prior-A',security_id:'held',request_id:'prior-request',choice:'hold',reason:'이전 판단 A',review_condition:'다음 실적',analysis_id:null,created_at:'2026-10-18T01:00:00Z',scenario_snapshot:{}};}

function fixture({unavailable=false}={}){
  const nodes=new Map(),persisted=[prior()],calls={writes:[],reads:0,analysisReads:0};let ctx,sequence=0,request=0;
  function node(id){let ownId=id;const el={value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},children:[],isConnected:true,
    get id(){return ownId},set id(value){if(ownId)nodes.delete(ownId);ownId=value;if(value)nodes.set(value,el)},
    addEventListener(type,fn){this.listeners[type]=fn},appendChild(child){this.children.push(child);child.parentElement=this;return child},
    prepend(child){this.children.unshift(child)},insertAdjacentElement(){},insertAdjacentHTML(where,value){this.innerHTML=where==='afterbegin'?value+this.innerHTML:this.innerHTML+value},setAttribute(){},
    remove(){nodes.delete(this.id);this.isConnected=false},contains(){return false},scrollIntoView(){},focus(){ctx.document.activeElement=this},
    closest(selector){return selector==='form'?nodes.get('detailDecisionForm'):selector.includes('#detailExtras')?nodes.get('detailStart'):null},matches(){return true},
    dispatchEvent(event){if(event.type==='input')ctx.body.oninput({target:this});this.listeners[event.type]?.call(this,event)},
    querySelector(selector){if(selector.includes('submit'))return nodes.get('submit');if(selector==='.review-status b')return {textContent:'아직 조건 미도달'};return null}
  };if(id)nodes.set(id,el);return el;}
  for(const id of ['detailStart','detailChoice','detailReason','detailReview','detailDecisionForm','detailChoiceGuide','detailDecisionStatus','detailDecisionHistory','detailReuseReason','detailWeightTarget','detailDown','detailUp','submit'])node(id);
  const element=id=>nodes.get(id);
  element('detailChoice').value='hold';element('detailDown').value='-10';element('detailUp').value='10';element('detailDecisionForm').hidden=true;
  const initial=unavailable?Object.assign([],{unavailable:true}):project(persisted);
  const scope={reviewEntry:false,console,Number,Date,JSON,Promise,Error,Object,Array,String,encodeURIComponent,liveAuthEpoch:1,
    document:{getElementById:element,createElement:()=>node('created-'+(++sequence)),querySelector:selector=>selector.includes('submit')?element('submit'):null,activeElement:null},
    window:{},atob,Event:class{constructor(type){this.type=type}},body:node('body'),startPanel:element('detailStart'),active:()=>true,id:'held',s:{symbol:'TEST'},
    results:[null,null,{thesis:null},initial],d:{},p:[{date:'2026-10-19',close:20}],activity:{items:[]},
    choiceLabels:{hold:'현재 유지',consider_reduction:'일부 축소 검토',pause_addition:'추가매수 보류',revisit:'추가 확인 후 판단'},
    detailDirtyGroups:{},detailInputChanged:false,lastComparison:null,lastComparisonDirty:false,lastDetailAnalysisId:null,lastAnalysisComparison:false,
    decisionRequestId:null,decisionRequestKey:null,pendingDecisionSubmission:null,live:{reviewDecisions:[]},decisionHomeDirty:false,crypto:{randomUUID:()=>`request-${++request}`},
    updateDetailStart(){},revealDetailTarget(){},closeSecurityDetail(){},aiSourceLinks(){},priceFocusedThesis:()=>false,
    decisionChangeHtml:()=>'',decisionReviewHtml:()=>'',kstStamp:String,kstDate:()=> '2026-10-19',esc:String,weightPct:String,SUPABASE_URL:'https://example.test',
    authFetch:async()=>{calls.analysisReads++;return {ok:true,json:async()=>[]}},
    async saveDecisionReceipt(args){
      calls.writes.push(clone(args));const row={id:`saved-${calls.writes.length}`,security_id:args.p_security_id,request_id:args.p_request_id,choice:args.p_choice,
        reason:args.p_reason,review_condition:args.p_review_condition,analysis_id:args.p_analysis_id,created_at:'2026-10-19T01:00:00Z',scenario_snapshot:{}};
      persisted.unshift(row);return {ok:true,id:row.id};
    },
    async rpc(name,args){assert.equal(name,'get_investment_decisions');assert.equal(args.p_security_id,'held');calls.reads++;return project(persisted)}
  };
  ctx=vm.createContext(scope);vm.runInContext(source,ctx);ctx.bindDecisionDraft();
  const input=(id,value)=>{const el=element(id);el.value=value;el.dispatchEvent(new ctx.Event('input'))};
  const prepare=()=>{ctx.openDecisionForm();input('detailReason','새로 저장한 판단 B');input('detailReview','다음 분기 실적')};
  return {ctx,element,persisted,calls,prepare,submit:()=>element('detailDecisionForm').onsubmit({preventDefault(){}})};
}

function assertLatestSave(f){
  assert.equal(f.ctx.latestDecisionRows[0].reason,'새로 저장한 판단 B');
  assert.equal(f.ctx.latestDecisionRows.length,2);
  assert.match(f.element('detailDecisionSummary').innerHTML,/새로 저장한 판단 B/);
  assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);
  assert.equal(f.element('detailDecisionForm').hidden,true);
}

for(const outcome of ['success','failure'])test(`late decision-history ${outcome} cannot replace a verified new judgment`,async()=>{
  const f=fixture(),pending=deferred(),started=deferred(),read=f.ctx.rpc,old=project(f.persisted);let first=true;
  f.ctx.rpc=(...args)=>{if(first){first=false;started.resolve();return pending.promise}return read(...args)};
  const refresh=f.ctx.refreshDecisionReview();await started.promise;
  f.prepare();await f.submit();assertLatestSave(f);const summary=f.element('detailDecisionSummary').innerHTML;
  if(outcome==='success')pending.resolve(old);else pending.reject(Error('old history failed'));
  await refresh;assertLatestSave(f);assert.equal(f.element('detailDecisionSummary').innerHTML,summary);
  assert.equal(f.ctx.reviewRefreshFailed,false,'an obsolete read failure must not mark the current review as failed');
});

for(const outcome of ['success','failure'])test(`late analysis-history ${outcome} cannot resume an obsolete decision refresh`,async()=>{
  const f=fixture(),pending=deferred();f.ctx.authFetch=()=>pending.promise;
  const refresh=f.ctx.refreshDecisionReview();f.prepare();await f.submit();assertLatestSave(f);
  if(outcome==='success')pending.resolve({ok:true,json:async()=>[{id:'old-analysis'}]});else pending.reject(Error('old analysis failed'));
  await refresh;assertLatestSave(f);assert.equal(f.calls.reads,1,'only the new save may perform its decision readback');
  assert.equal(f.ctx.reviewAnalyses.length,0);assert.equal(f.ctx.reviewRefreshFailed,false);
});

test('background refresh and history retry skip competing reads during a save and resume afterwards',async()=>{
  const f=fixture(),pending=deferred(),write=f.ctx.saveDecisionReceipt;
  f.ctx.saveDecisionReceipt=async args=>{await pending.promise;return write(args)};
  f.prepare();const saving=f.submit();assert.equal(f.element('submit').disabled,true);
  await f.ctx.refreshDecisionReview();await f.ctx.retryDecisionHistory();
  assert.equal(f.calls.analysisReads,0);assert.equal(f.calls.reads,0);
  pending.resolve();await saving;assertLatestSave(f);assert.equal(f.ctx.reviewRefreshFailed,false);
  await f.ctx.refreshDecisionReview();assert.equal(f.calls.analysisReads,1,'normal refresh resumes once the save settles');
});

for(const outcome of ['success','failure'])test(`late manual history retry ${outcome} cannot erase the newly saved judgment`,async()=>{
  const f=fixture({unavailable:true}),pending=deferred(),read=f.ctx.rpc,old=project(f.persisted);let first=true;
  f.ctx.rpc=(...args)=>first?(first=false,pending.promise):read(...args);
  const retry=f.element('detailDecisionRetry').onclick();f.prepare();await f.submit();assertLatestSave(f);
  const failedBefore=f.ctx.reviewRefreshFailed;
  if(outcome==='success')pending.resolve(old);else pending.reject(Error('old retry failed'));
  await retry;assertLatestSave(f);assert.equal(f.ctx.latestDecisionRows.unavailable,undefined);
  assert.equal(f.ctx.reviewRefreshFailed,failedBefore);assert.equal(f.calls.analysisReads,0,'an obsolete manual retry must not start a new background refresh');
});

test('a superseded history retry remains usable when the overlapping save also fails',async()=>{
  const f=fixture({unavailable:true}),pending=deferred(),button=f.element('detailDecisionRetry');f.ctx.rpc=()=>pending.promise;
  const retry=button.onclick();assert.equal(button.disabled,true);
  f.prepare();f.ctx.saveDecisionReceipt=async()=>{throw Error('save unavailable')};await f.submit();
  assert.match(f.element('detailDecisionStatus').textContent,/판단 저장 실패/);
  pending.resolve(project(f.persisted));await retry;
  assert.equal(f.ctx.latestDecisionRows.unavailable,true,'superseded response is ignored');
  assert.equal(button.disabled,false,'the still-visible retry must recover after both requests settle');
  assert.equal(button.textContent,'저장한 판단 다시 불러오기');
  f.ctx.rpc=async()=>[];await button.onclick();assert.equal(f.ctx.latestDecisionRows.unavailable,undefined);
  assert.equal(f.element('detailReason').value,'새로 저장한 판단 B');assert.equal(f.element('detailDecisionForm').hidden,false);
});
