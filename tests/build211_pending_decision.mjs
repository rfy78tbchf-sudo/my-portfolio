import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Pending-save regressions run the production form/draft/history handlers in isolated runtimes.
// This test never connects to an account or generates an AI response.
const html=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
// Use the getter's real projection: table rows used directly as RPC responses
// previously hid a missing request_id in interrupted-save recovery.
const decisionSql=readFileSync(process.env.PORTFOLIO_DECISION_SQL||new URL('../supabase/build211_decision_request_readback.sql',import.meta.url),'utf8');
const getter=decisionSql.slice(decisionSql.indexOf('create or replace function public.get_investment_decisions'));
const projection=getter.match(/from \(select ([\s\S]*?) from public\.investment_decisions d/);
assert.ok(projection,'decision getter projection');
const decisionFields=[...projection[1].matchAll(/d\.([a-z_]+)/g)].map(match=>match[1]);
const decisionRows=rows=>rows.map(row=>Object.fromEntries(decisionFields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])));
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
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function saved(choice='pause_addition',extra={}){return {id:'prior-1',security_id:'held',choice,reason:'실적을 더 확인하려고',review_condition:'2026-10-01',created_at:'2026-10-01T01:00:00Z',analysis_id:'old-ai',scenario_snapshot:{},...extra};}
function fixture(rows=[saved()],options={}){
  const nodes=new Map();let sequence=0,request=0,ctx;
  function node(id){let ownId=id;const el={value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},children:[],isConnected:true,
    get id(){return ownId},set id(value){if(ownId)nodes.delete(ownId);ownId=value;if(value)nodes.set(value,el)},
    addEventListener(type,fn){this.listeners[type]=fn},appendChild(child){this.children.push(child);child.parentElement=this;return child},
    prepend(child){this.children.unshift(child)},insertAdjacentElement(){},insertAdjacentHTML(where,value){this.innerHTML=where==='afterbegin'?value+this.innerHTML:this.innerHTML+value},setAttribute(){},
    remove(){nodes.delete(this.id);this.isConnected=false},contains(){return false},scrollIntoView(){},focus(){ctx.document.activeElement=this},
    closest(selector){return selector==='form'?(this.id==='detailWeightTarget'||this.id==='detailDown'||this.id==='detailUp'?null:nodes.get('detailDecisionForm')):selector.includes('#detailExtras')?nodes.get('detailStart'):null},
    matches(){return true},dispatchEvent(event){if(event.type==='input')ctx.body.oninput({target:this});this.listeners[event.type]?.call(this,event)},
    querySelector(selector){if(selector.includes('submit'))return nodes.get('submit');if(selector==='.review-status b')return {textContent:'아직 조건 미도달'};return null}
  };if(id)nodes.set(id,el);return el;}
  for(const id of ['detailStart','detailStartHint','detailChoice','detailReason','detailReview','detailDecisionForm','detailChoiceGuide','detailDecisionStatus','detailDecisionHistory','detailReuseReason','detailWeightTarget','detailDown','detailUp','submit'])node(id);
  const element=id=>nodes.get(id);
  element('detailChoice').value='hold';element('detailDecisionForm').hidden=true;
  element('detailDown').value='-10';element('detailUp').value='10';
  const persisted=clone(rows),calls=[];
  const scope={reviewEntry:false,console,Number,Date,JSON,Promise,Error,Object,Array,String,encodeURIComponent,liveAuthEpoch:1,
    document:{getElementById:element,createElement:()=>node('created-'+(++sequence)),querySelector:selector=>selector.includes('submit')?element('submit'):null,activeElement:null},
    session:options.session,atob,localStorage:options.storage,window:{},Event:class{constructor(type,options){this.type=type;Object.assign(this,options)}},
    body:node('body'),startPanel:element('detailStart'),active:()=>true,id:'held',s:{symbol:'TEST'},
    results:[null,null,{thesis:null},options.unavailable?Object.assign([],{unavailable:true}):clone(decisionRows(rows))],d:{},p:[{date:'2026-10-08',close:20}],activity:{items:[]},
    choiceLabels:{hold:'현재 유지',consider_reduction:'일부 축소 검토',pause_addition:'추가매수 보류',revisit:'추가 확인 후 판단'},
    detailDirtyGroups:{},detailInputChanged:false,lastComparison:null,lastComparisonDirty:false,lastDetailAnalysisId:null,lastAnalysisComparison:false,
    decisionRequestId:null,decisionRequestKey:null,pendingDecisionSubmission:null,live:{reviewDecisions:[]},decisionHomeDirty:false,
    crypto:{randomUUID:()=>`request-${options.runtime||'initial'}-${++request}`},
    updateDetailStart(){},revealDetailTarget(){},closeSecurityDetail(){},aiSourceLinks(){},priceFocusedThesis:()=>false,
    decisionChangeHtml:()=>'',decisionReviewHtml:()=>'',kstStamp:String,kstDate:()=> '2026-10-09',esc:String,weightPct:String,
    SUPABASE_URL:'https://example.test',authFetch:async()=>({ok:true,json:async()=>[]}),
    async saveDecisionReceipt(args){calls.push(clone(args));const existing=persisted.find(row=>row.request_id===args.p_request_id);
      if(existing){assert.equal(ctx.decisionRowMatchesSubmission(existing,args),true,'same request may only acknowledge its original payload');return {ok:true,id:existing.id};}
      const row={id:`saved-${options.runtime||'initial'}-${calls.length}`,security_id:args.p_security_id,request_id:args.p_request_id,choice:args.p_choice,reason:args.p_reason,review_condition:args.p_review_condition,analysis_id:args.p_analysis_id,created_at:'2026-10-09T01:00:00Z',scenario_snapshot:{}};
      if(args.p_target_pct!==null)row.scenario_snapshot.choice_comparison={target_pct:args.p_target_pct,price_assumptions:{down_pct:args.p_down_pct,up_pct:args.p_up_pct},observation_at:args.p_observation_at,hold:{value_krw:10000},reduce:{mode:'integer_shares'}};
      persisted.unshift(row);return {ok:true,id:row.id};},
    async rpc(name){assert.equal(name,'get_investment_decisions');return clone(decisionRows(persisted))}
  };
  ctx=vm.createContext(scope);vm.runInContext(source,ctx);
  const edit=()=>element('detailDecisionAction').onclick();
  const input=(id,value)=>{const el=element(id);el.value=value;el.dispatchEvent(new ctx.Event('input',{bubbles:true}));if(id==='detailChoice')el.dispatchEvent(new ctx.Event('change'))};
  const values=()=>['detailChoice','detailReason','detailReview'].map(id=>element(id).value);
  return {ctx,element,persisted,calls,edit,input,values,submit:()=>element('detailDecisionForm').onsubmit({preventDefault(){}})};
}

const durableStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values}};
const draftSession=sub=>({accessToken:'test.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.test'});
function durableFixture(storage,rows=[],options={}){
  const f=fixture(rows,{storage,session:draftSession(options.owner||'owner'),...options});f.ctx.bindDecisionDraft();return f;
}
const readDraft=(storage,fixture)=>JSON.parse(storage.getItem(fixture.ctx.decisionDraftKey('held')));
function currentComparison(f,{target=15,down=-10,up=10,observation='2026-10-18T01:00:00Z',analysis='submitted-ai'}={}){
  f.element('detailWeightTarget').value=String(target);f.element('detailDown').value=String(down);f.element('detailUp').value=String(up);
  f.ctx.lastComparison={targetPct:target,downPct:down,upPct:up,observationAt:observation};f.ctx.lastComparisonDirty=false;
  f.ctx.lastDetailAnalysisId=analysis;f.ctx.lastAnalysisComparison=true;
}
async function interrupted({comparison=false,commit=true,target=15}={}){
  const storage=durableStorage(),f=durableFixture(storage);
  f.ctx.openDecisionForm();f.input('detailReason','그대로 유지할 이유');f.input('detailReview','다음 실적 발표');
  f.ctx.lastDetailAnalysisId='submitted-ai';
  if(comparison){f.input('detailChoice','consider_reduction');currentComparison(f,{target});}
  const write=f.ctx.saveDecisionReceipt,attempts=[];
  f.ctx.saveDecisionReceipt=async args=>{attempts.push(clone(args));if(commit)await write(args);throw Error('write result and receipt lookup unavailable')};
  await f.submit();assert.equal(attempts.length,1);assert.ok(readDraft(storage,f).pendingSubmission);
  return {storage,f,args:attempts[0],original:clone(f.persisted)};
}

for(const comparison of [false,true])test(`fresh runtime retries the exact ${comparison?'comparison':'analysis-linked'} submission after all readback fails`,async()=>{
  const {storage,f,args,original}=await interrupted({comparison}),back=durableFixture(storage,f.persisted,{runtime:'restart',unavailable:true});
  assert.equal(back.ctx.lastDetailAnalysisId,null);assert.equal(back.ctx.lastComparison,null);assert.equal(back.calls.length,0,'opening never replays a write');
  assert.match(back.element('detailDecisionStatus').textContent,/이전에 보낸 저장 결과를 아직 확인하지 못했습니다/);
  assert.doesNotMatch(back.element('detailDecisionStatus').textContent,/아직 저장된 판단이 아닙니다/);
  await back.submit();assert.deepEqual(back.calls,[args]);assert.deepEqual(back.persisted,original);
  assert.equal(back.element('detailDecisionForm').hidden,true);assert.equal(storage.values.size,0);assert.equal(back.ctx.pendingDecisionSubmission,null);
  assert.equal(back.ctx.lastDetailAnalysisId,null,'retry must not pretend the old evidence was freshly calculated');
});
test('prefilled explicit submission persists the original request before awaiting, without any input event',async()=>{
  const storage=durableStorage(),f=durableFixture(storage,[saved('hold')]),wait=deferred();f.edit();
  assert.deepEqual(f.ctx.detailDirtyGroups,{});f.ctx.lastDetailAnalysisId='prefill-analysis';
  f.ctx.saveDecisionReceipt=async()=>{await wait.promise;throw Error('offline')};const saving=f.submit();
  const draft=readDraft(storage,f);assert.equal(draft.pendingSubmission.args.p_analysis_id,'prefill-analysis');
  assert.equal(draft.pendingSubmission.args.p_reason,'실적을 더 확인하려고');assert.ok(draft.requestId);
  wait.resolve();await saving;
  const back=durableFixture(storage,[],{runtime:'restart',unavailable:true});await back.submit();
  assert.deepEqual(back.calls[0],draft.pendingSubmission.args);assert.equal(back.element('detailDecisionForm').hidden,true);
});
for(const [field,value] of [['detailReason','그대로 유지할 이유  '],['detailReview','  다음 실적 발표\n'],['detailWeightTarget','15.00'],['detailDown','-10.0'],['detailUp','10.000']])test(`format-only ${field} edit retries one request and leaves no duplicate draft`,async()=>{
  const {storage,f,args,original}=await interrupted({comparison:true});f.input(field,value);
  const back=durableFixture(storage,f.persisted,{runtime:'formatted',unavailable:true});await back.submit();
  assert.deepEqual(back.calls,[args]);assert.deepEqual(back.persisted,original);assert.equal(storage.values.size,0);
  assert.equal(back.element('detailDecisionForm').hidden,true);assert.equal(back.ctx.pendingDecisionSubmission,null);
  assert.equal(durableFixture(storage,f.persisted).element('detailDecisionForm').hidden,true);
});
test('confirming an old submission preserves a later reason and review, with no reuse on its next save',async()=>{
  const {storage,f,args,original}=await interrupted();f.input('detailReason','새로 수정한 이유');f.input('detailReview','새 공시가 나오면 확인');
  const back=durableFixture(storage,f.persisted,{runtime:'new-reason'});
  assert.deepEqual(back.values(),['hold','새로 수정한 이유','새 공시가 나오면 확인']);assert.equal(back.element('detailDecisionForm').hidden,false);
  const draft=readDraft(storage,back);assert.equal(draft.pendingSubmission,null);assert.equal(draft.requestId,null);
  assert.equal(back.calls.length,0);assert.match(back.element('detailDecisionStatus').textContent,/이후 수정한 내용은 아직 초안/);
  await back.submit();assert.notEqual(back.calls[0].p_request_id,args.p_request_id);assert.equal(back.calls[0].p_analysis_id,null);
  assert.deepEqual(back.persisted[1],original[0]);assert.equal(back.persisted[0].reason,'새로 수정한 이유');assert.equal(storage.values.size,0);
});
for(const [field,value] of [['detailWeightTarget','12'],['detailDown','-20'],['detailUp','25']])test(`late original receipt preserves a newer ${field} assumption even with unchanged decision text`,async()=>{
  const {storage,f,args,original}=await interrupted({comparison:true});f.input(field,value);
  const stored=readDraft(storage,f);assert.equal(stored.values[field],value);assert.notEqual(stored.pendingSubmission.values[field],value);
  const back=durableFixture(storage,f.persisted,{runtime:field});assert.equal(back.element(field).value,value);
  assert.equal(back.element('detailDecisionForm').hidden,false);assert.equal(back.ctx.pendingDecisionSubmission,null);assert.ok(back.ctx.detailDirtyGroups.detailDecisionForm);
  await back.submit();assert.equal(back.calls.length,0,'changed assumptions still need current comparison and evidence');
  currentComparison(back,{target:Number(back.element('detailWeightTarget').value),down:Number(back.element('detailDown').value),up:Number(back.element('detailUp').value),analysis:'new-ai',observation:'2026-10-19T01:00:00Z'});
  await back.submit();assert.notEqual(back.calls[0].p_request_id,args.p_request_id);assert.equal(back.calls[0].p_analysis_id,'new-ai');
  assert.deepEqual(back.persisted[1],original[0]);assert.equal(storage.values.size,0);
});
test('comparison-only edit while a write is pending survives successful readback and a fresh runtime',async()=>{
  const storage=durableStorage(),f=durableFixture(storage),wait=deferred();f.input('detailReason','submitted');f.input('detailReview','next');currentComparison(f);
  const write=f.ctx.saveDecisionReceipt;f.ctx.saveDecisionReceipt=async args=>{const receipt=await write(args);await wait.promise;return receipt};
  const saving=f.submit(),dirty=f.ctx.detailDirtyGroups.detailDecisionForm;f.input('detailDown','-22');
  assert.equal(f.ctx.detailDirtyGroups.detailDecisionForm,dirty,'comparison input is outside the decision form');wait.resolve();await saving;
  assert.equal(f.element('detailDecisionForm').hidden,false);assert.equal(f.persisted[0].scenario_snapshot.choice_comparison.price_assumptions.down_pct,-10);
  const back=durableFixture(storage,f.persisted);assert.equal(back.element('detailDown').value,'-22');assert.equal(back.ctx.pendingDecisionSubmission,null);
});
test('read-only history recovery removes only a fully matched pending submission and never sends a write',async()=>{
  const {storage,f,original}=await interrupted({comparison:true}),back=durableFixture(storage,[],{unavailable:true});
  back.ctx.renderDecisionHistory(clone(decisionRows(f.persisted)));
  assert.equal(back.element('detailDecisionForm').hidden,true);assert.equal(storage.values.size,0);assert.equal(back.calls.length,0);
  assert.deepEqual(clone(back.ctx.latestDecisionRows),decisionRows(original));
});
for(const [label,mutate] of [
  ['missing comparison',row=>{row.scenario_snapshot={};}],
  ['wrong analysis',row=>{row.analysis_id='other-ai';}],
  ['wrong request',row=>{row.request_id='other-request';}],
  ['wrong target',row=>{row.scenario_snapshot.choice_comparison.target_pct=14;}],
  ['wrong price assumption',row=>{row.scenario_snapshot.choice_comparison.price_assumptions.down_pct=-20;}],
  ['wrong observation',row=>{row.scenario_snapshot.choice_comparison.observation_at='2026-10-19T01:00:00Z';}]
])test(`restart readback with ${label} cannot confirm or erase the original draft`,async()=>{
  const {storage,f}=await interrupted({comparison:true}),row=clone(f.persisted[0]);mutate(row);
  const back=durableFixture(storage,[row]);assert.equal(back.element('detailDecisionForm').hidden,false);assert.ok(back.ctx.pendingDecisionSubmission);
  assert.equal(storage.values.size,1);assert.equal(back.calls.length,0);assert.match(back.element('detailDecisionStatus').textContent,/아직 확인하지 못했습니다/);
});
for(const [label,mutate] of [
  ['other security',draft=>{draft.pendingSubmission.args.p_security_id='another-security';}],
  ['other owner',draft=>{draft.pendingSubmission.ownerKey='portfolio_decision_draft_v1:other:held';}],
  ['mismatched request identity',draft=>{draft.pendingSubmission.args.p_request_id='unrelated-request';}],
  ['unknown RPC parameter',draft=>{draft.pendingSubmission.args.p_user_id='another-owner';}],
  ['partial comparison arguments',draft=>{draft.pendingSubmission.args.p_down_pct=null;}]
])test(`persisted pending data rejects ${label} while retaining editable input`,async()=>{
  const {storage,f}=await interrupted({comparison:true}),key=f.ctx.decisionDraftKey('held'),draft=readDraft(storage,f);mutate(draft);storage.setItem(key,JSON.stringify(draft));
  const back=durableFixture(storage,[],{unavailable:true});assert.equal(back.ctx.pendingDecisionSubmission,null);assert.equal(back.ctx.decisionRequestId,null);
  assert.equal(back.values()[1],'그대로 유지할 이유');assert.equal(back.calls.length,0);await back.submit();assert.equal(back.calls.length,0);
});
test('another signed-in owner cannot see or replay pending data from the prior owner',async()=>{
  const {storage,f,args}=await interrupted(),other=durableFixture(storage,[],{owner:'another-owner'});
  assert.deepEqual(other.values(),['hold','','']);assert.equal(other.ctx.pendingDecisionSubmission,null);assert.equal(other.calls.length,0);
  assert.equal(readDraft(storage,f).pendingSubmission.args.p_request_id,args.p_request_id);
});
for(const comparison of [false,true])test(`legacy v1 ${comparison?'zero target comparison':'false-tuple plain'} request remains retryable with its original linked analysis`,async()=>{
  const {storage,f,args,original}=await interrupted({comparison,target:0}),key=f.ctx.decisionDraftKey('held'),draft=readDraft(storage,f);delete draft.pendingSubmission;storage.setItem(key,JSON.stringify(draft));
  const back=durableFixture(storage,f.persisted,{unavailable:true,runtime:'legacy'});assert.equal(back.ctx.pendingDecisionSubmission.args.p_analysis_id,args.p_analysis_id);
  await back.submit();assert.deepEqual(back.calls,[args]);assert.deepEqual(back.persisted,original);assert.equal(storage.values.size,0);
});
for(const comparison of [false,true])test(`legacy request identity never attributes edited ${comparison?'comparison':'plain'} draft values to an old receipt`,async()=>{
  const {storage,f,original}=await interrupted({comparison,target:0}),key=f.ctx.decisionDraftKey('held'),draft=readDraft(storage,f);delete draft.pendingSubmission;
  draft.values.detailWeightTarget='8';draft.values.detailReason='이후 작성한 새 이유';storage.setItem(key,JSON.stringify(draft));
  const back=durableFixture(storage,f.persisted);assert.equal(back.values()[1],'이후 작성한 새 이유');assert.equal(back.element('detailWeightTarget').value,'8');
  assert.equal(back.element('detailDecisionForm').hidden,false);assert.equal(back.ctx.pendingDecisionSubmission,null);assert.equal(back.calls.length,0);
  assert.deepEqual(f.persisted,original);assert.ok(readDraft(storage,back));
});
for(const fresh of ['analysis','observation'])test(`explicitly refreshed ${fresh} evidence can replace a rejected old submission with unchanged reasons and numeric assumptions`,async()=>{
  const {storage,f,args}=await interrupted({comparison:true,commit:false}),freshAnalysis=fresh==='analysis'?'newly-confirmed-ai':'submitted-ai',freshObservation=fresh==='observation'?'2026-10-19T01:00:00Z':'2026-10-18T01:00:00Z';
  currentComparison(f,{analysis:freshAnalysis,observation:freshObservation});f.ctx.updateDecisionGuide();
  assert.doesNotMatch(f.element('submit').textContent,/재시도/);assert.match(f.element('detailChoiceGuide').textContent,/최신 자료로 새 판단/);
  const writes=[];
  f.ctx.saveDecisionReceipt=async payload=>{writes.push(clone(payload));if(payload.p_request_id===args.p_request_id)throw Error('old observation rejected');
    const row={id:'fresh-success',security_id:'held',request_id:payload.p_request_id,choice:payload.p_choice,reason:payload.p_reason,review_condition:payload.p_review_condition,analysis_id:payload.p_analysis_id,scenario_snapshot:{choice_comparison:{target_pct:payload.p_target_pct,price_assumptions:{down_pct:payload.p_down_pct,up_pct:payload.p_up_pct},observation_at:payload.p_observation_at,hold:{value_krw:10000},reduce:{mode:'integer_shares'}}},created_at:'2026-10-19T01:00:00Z'};
    f.persisted.unshift(row);return {ok:true,id:row.id};};
  await f.submit();assert.equal(writes.length,1);assert.notEqual(writes[0].p_request_id,args.p_request_id);assert.equal(writes[0].p_analysis_id,freshAnalysis);assert.equal(writes[0].p_observation_at,freshObservation);
  assert.equal(f.element('detailDecisionForm').hidden,true);assert.equal(storage.values.size,0);assert.equal(f.persisted.length,1);
});
test('a genuinely changed new judgment can save after permanent rejection of the previous one',async()=>{
  const {storage,f,args}=await interrupted({comparison:true,commit:false});f.input('detailChoice','revisit');f.input('detailReason','이번에는 자료를 더 확인하기로 함');
  f.input('detailWeightTarget','');f.ctx.lastComparison=null;f.ctx.lastComparisonDirty=false;f.ctx.lastDetailAnalysisId=null;f.ctx.lastAnalysisComparison=false;
  const back=durableFixture(storage,[],{runtime:'new-judgment',unavailable:true});await back.submit();assert.equal(back.calls.length,1);assert.notEqual(back.calls[0].p_request_id,args.p_request_id);
  assert.equal(back.calls[0].p_analysis_id,null);assert.equal(back.calls[0].p_target_pct,null);assert.equal(back.persisted.length,1);assert.equal(storage.values.size,0);
});
test('a restored in-memory pending draft does not claim durable device storage when localStorage is blocked',async()=>{
  const {f}=await interrupted(),blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
  const back=fixture([],{storage:blocked,session:draftSession('owner')});back.ctx.decisionDrafts=f.ctx.decisionDrafts;back.ctx.decisionDraftOwner=f.ctx.decisionDraftOwner;back.ctx.bindDecisionDraft();
  assert.match(back.element('detailDecisionStatus').textContent,/기기에 보관하지 못해 이 화면에만/);assert.equal(back.calls.length,0);
});
test('failed device writes cannot replace a newer in-memory draft with an older device copy on return',async()=>{
  const {storage,f,args}=await interrupted(),prior=storage.getItem(f.ctx.decisionDraftKey('held'));
  storage.setItem=()=>{throw Error('quota full')};f.input('detailReason','보관 실패 뒤에도 화면에 남아야 할 새 이유');
  assert.equal(storage.getItem(f.ctx.decisionDraftKey('held')),prior);
  const back=fixture([],{storage,session:draftSession('owner'),unavailable:true});back.ctx.decisionDrafts=f.ctx.decisionDrafts;back.ctx.decisionDraftOwner=f.ctx.decisionDraftOwner;back.ctx.bindDecisionDraft();
  assert.equal(back.values()[1],'보관 실패 뒤에도 화면에 남아야 할 새 이유');assert.equal(back.ctx.pendingDecisionSubmission.args.p_request_id,args.p_request_id);
  assert.equal(back.calls.length,0);assert.match(back.element('detailDecisionStatus').textContent,/기기에 보관하지 못해 이 화면에만/);
});


test('failed draft retention keeps the editor open until device storage recovers',()=>{
  const storage=durableStorage(),f=durableFixture(storage),write=storage.setItem;
  f.ctx.openDecisionForm();f.input('detailReason','다음 실적을 확인');f.input('detailReview','매출 발표');
  storage.setItem=()=>{throw Error('quota full')};
  f.input('detailReason','보관에 실패한 최신 이유');
  assert.equal(f.ctx.allowDetailLeave('leave?'),false);
  assert.match(f.element('detailDecisionStatus').textContent,/초안을 보관하지 못했습니다/);
  assert.equal(f.values()[1],'보관에 실패한 최신 이유');assert.equal(f.calls.length,0);
  storage.setItem=write;
  assert.equal(f.ctx.allowDetailLeave('leave?'),true);
  assert.equal(readDraft(storage,f).values.detailReason,'보관에 실패한 최신 이유');
});
test('pending request stays visible when its draft cannot be retained',async()=>{
  const {storage,f,args}=await interrupted();storage.setItem=()=>{throw Error('blocked')};
  assert.equal(f.ctx.allowDetailLeave('leave?'),false);
  assert.equal(f.ctx.pendingDecisionSubmission.args.p_request_id,args.p_request_id);
  assert.match(f.element('detailDecisionStatus').textContent,/초안을 보관하지 못했습니다/);
});
test('restored ordinary memory draft exposes failed device retention',()=>{
  const storage=durableStorage(),f=durableFixture(storage);
  f.ctx.openDecisionForm();f.input('detailReason','이유');f.input('detailReview','조건');
  storage.setItem=()=>{throw Error('blocked')};
  const back=fixture([],{storage,session:draftSession('owner')});
  back.ctx.decisionDrafts=f.ctx.decisionDrafts;back.ctx.decisionDraftOwner=f.ctx.decisionDraftOwner;back.ctx.bindDecisionDraft();
  assert.match(back.element('detailDecisionStatus').textContent,/초안을 보관하지 못했습니다/);
  assert.equal(back.calls.length,0);
});
