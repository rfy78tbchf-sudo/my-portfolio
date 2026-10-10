import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Production handlers with isolated DOM/RPC doubles; never uses a real account.
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
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function saved(choice='pause_addition',extra={}){return {id:'prior-1',security_id:'held',choice,reason:'실적을 더 확인하려고',review_condition:'2026-10-01',created_at:'2026-10-01T01:00:00Z',analysis_id:'old-ai',scenario_snapshot:{},...extra};}
function fixture(rows=[saved()]){
  const nodes=new Map();let sequence=0,request=0,ctx;
  function node(id){let ownId=id;const el={value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},children:[],isConnected:true,
    get id(){return ownId},set id(value){if(ownId)nodes.delete(ownId);ownId=value;if(value)nodes.set(value,el)},
    addEventListener(type,fn){this.listeners[type]=fn},appendChild(child){this.children.push(child);child.parentElement=this;return child},
    prepend(child){this.children.unshift(child)},insertAdjacentElement(){},insertAdjacentHTML(where,value){this.innerHTML=where==='afterbegin'?value+this.innerHTML:this.innerHTML+value},setAttribute(){},
    remove(){nodes.delete(this.id);this.isConnected=false},contains(){return false},scrollIntoView(){},focus(){ctx.document.activeElement=this},
    closest(selector){return selector==='form'?nodes.get('detailDecisionForm'):selector.includes('#detailExtras')?nodes.get('detailStart'):null},
    matches(){return true},dispatchEvent(event){if(event.type==='input')ctx.body.oninput({target:this});this.listeners[event.type]?.call(this,event)},
    querySelector(selector){if(selector.includes('submit'))return nodes.get('submit');if(selector==='.review-status b')return {textContent:'아직 조건 미도달'};return null}
  };if(id)nodes.set(id,el);return el;}
  for(const id of ['detailStart','detailChoice','detailReason','detailReview','detailDecisionForm','detailChoiceGuide','detailDecisionStatus','detailDecisionHistory','detailReuseReason','detailWeightTarget','detailDown','detailUp','submit'])node(id);
  const element=id=>nodes.get(id);
  element('detailChoice').value='hold';element('detailDecisionForm').hidden=true;
  element('detailDown').value='-10';element('detailUp').value='10';
  const persisted=clone(rows),calls=[];
  const scope={console,Number,Date,JSON,Promise,Error,Object,Array,String,encodeURIComponent,liveAuthEpoch:1,
    document:{getElementById:element,createElement:()=>node('created-'+(++sequence)),querySelector:selector=>selector.includes('submit')?element('submit'):null,activeElement:null},
    window:{},Event:class{constructor(type,options){this.type=type;Object.assign(this,options)}},
    body:node('body'),startPanel:element('detailStart'),active:()=>true,id:'held',s:{symbol:'TEST'},
    results:[null,null,{thesis:null},clone(rows)],d:{},p:[{date:'2026-10-08',close:20}],activity:{items:[]},
    choiceLabels:{hold:'현재 유지',consider_reduction:'일부 축소 검토',pause_addition:'추가매수 보류',revisit:'추가 확인 후 판단'},
    detailDirtyGroups:{},detailInputChanged:false,lastComparison:null,lastComparisonDirty:false,lastDetailAnalysisId:null,lastAnalysisComparison:false,
    decisionRequestId:null,decisionRequestKey:null,live:{reviewDecisions:[]},decisionHomeDirty:false,
    crypto:{randomUUID:()=>`request-${++request}`},
    updateDetailStart(){},revealDetailTarget(){},closeSecurityDetail(){},aiSourceLinks(){},priceFocusedThesis:()=>false,
    decisionChangeHtml:()=>'',decisionReviewHtml:()=>'',kstStamp:String,kstDate:()=> '2026-10-09',esc:String,weightPct:String,
    SUPABASE_URL:'https://example.test',authFetch:async()=>({ok:true,json:async()=>[]}),
    async saveDecisionReceipt(args){calls.push(clone(args));const row={id:`saved-${calls.length}`,security_id:args.p_security_id,choice:args.p_choice,reason:args.p_reason,review_condition:args.p_review_condition,analysis_id:args.p_analysis_id,created_at:'2026-10-09T01:00:00Z',scenario_snapshot:{}};
      if(args.p_target_pct!==null)row.scenario_snapshot.choice_comparison={target_pct:args.p_target_pct,price_assumptions:{down_pct:args.p_down_pct,up_pct:args.p_up_pct},observation_at:args.p_observation_at,hold:{value_krw:10000},reduce:{mode:'integer_shares'}};
      persisted.unshift(row);return {ok:true,id:row.id};},
    async rpc(name){assert.equal(name,'get_investment_decisions');return clone(persisted)}
  };
  ctx=vm.createContext(scope);vm.runInContext(source,ctx);
  const edit=()=>element('detailDecisionAction').onclick();
  const input=(id,value)=>{const el=element(id);el.value=value;el.dispatchEvent(new ctx.Event('input',{bubbles:true}));if(id==='detailChoice')el.dispatchEvent(new ctx.Event('change'))};
  const values=()=>['detailChoice','detailReason','detailReview'].map(id=>element(id).value);
  return {ctx,element,persisted,calls,edit,input,values,submit:()=>element('detailDecisionForm').onsubmit({preventDefault(){}})};
}

for(const choice of ['hold','consider_reduction','pause_addition','revisit'])test(`fresh edit restores saved ${choice}, reason and exact checkpoint`,()=>{
  const row=saved(choice),f=fixture([row]);assert.equal(f.element('detailDecisionForm').hidden,true);
  assert.equal(f.element('detailDecisionAction').textContent,'내 결정 수정하기');f.edit();
  assert.deepEqual(f.values(),[choice,row.reason,row.review_condition]);assert.equal(f.element('detailDecisionForm').hidden,false);
  assert.deepEqual(f.ctx.detailDirtyGroups,{});assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/새 판단/);
  assert.equal(f.element('submit').textContent,f.ctx.choiceLabels[choice]+' 기록 저장');
});
test('edit preserves an expired checkpoint verbatim instead of renewing or clearing it',()=>{
  const f=fixture([saved('revisit',{review_condition:'2026-01-02'})]);f.edit();assert.equal(f.values()[2],'2026-01-02');
});
for(const condition of ['종가 12 달러 이하','20·60·120개 종가 단순평균 정배열 이탈','새 공시가 나오면 확인','2027-01-01'])test(`checkpoint remains exact: ${condition}`,()=>{
  const f=fixture([saved('hold',{review_condition:condition})]);f.edit();assert.equal(f.values()[2],condition);
});
test('latest history at click time wins, without mutating either historical row',()=>{
  const old=saved(),newest=saved('revisit',{id:'prior-2',reason:'새로 저장한 이유',review_condition:'2027-01-02'}),rows=[newest,old],snapshot=clone(rows),f=fixture([old]);
  f.ctx.renderDecisionHistory(rows);f.edit();assert.deepEqual(f.values(),[newest.choice,newest.reason,newest.review_condition]);assert.deepEqual(rows,snapshot);
});
test('background history refresh and repeated edit do not overwrite a populated draft',async()=>{
  const f=fixture();f.edit();f.input('detailReason','작성 중인 새 이유');f.input('detailReview','새 점검 조건');f.input('detailChoice','revisit');
  f.persisted.unshift(saved('hold',{id:'other-save',reason:'다른 저장 내용'}));await f.ctx.refreshDecisionReview();f.edit();f.edit();
  assert.deepEqual(f.values(),['revisit','작성 중인 새 이유','새 점검 조건']);
});
test('untouched initialized values stay stable across a late history refresh',async()=>{
  const f=fixture();f.edit();const before=f.values();f.persisted.unshift(saved('revisit',{id:'later',reason:'나중 내용'}));await f.ctx.refreshDecisionReview();f.edit();assert.deepEqual(f.values(),before);
});
test('an intentionally emptied draft remains empty on subsequent edit',()=>{
  const f=fixture();f.edit();f.input('detailChoice','hold');f.input('detailReason','');f.input('detailReview','');f.edit();assert.deepEqual(f.values(),['hold','','']);
});
for(const [id,value] of [['detailChoice','revisit'],['detailReason','이미 쓰던 이유'],['detailReview','이미 쓰던 조건']])test(`draft edited through another entry preserves ${id}`,()=>{
  const f=fixture();f.ctx.openDecisionForm();f.input(id,value);const before=f.values();f.edit();assert.deepEqual(f.values(),before);
});
test('editing then clearing before the first edit action still preserves intentional blanks',()=>{
  const f=fixture();f.ctx.openDecisionForm();f.input('detailReason','temporary');f.input('detailReason','');f.edit();assert.deepEqual(f.values(),['hold','','']);
});
test('programmatically populated values are not overwritten even without dirty events',()=>{
  const f=fixture();f.element('detailReason').value='복원된 초안';f.edit();assert.deepEqual(f.values(),['hold','복원된 초안','']);
});
test('empty history uses the existing blank record form',()=>{
  const f=fixture([]);assert.equal(f.element('detailDecisionAction').textContent,'내 결정 기록하기');f.edit();assert.deepEqual(f.values(),['hold','','']);assert.equal(f.calls.length,0);
});
test('closed or superseded detail ignores a stale edit callback',()=>{
  const f=fixture(),edit=f.element('detailDecisionAction').onclick;f.ctx.active=()=>false;edit();assert.deepEqual(f.values(),['hold','','']);assert.equal(f.element('detailDecisionForm').hidden,true);
});
test('reopening a detail starts clean and loads the newly saved values',async()=>{
  const f=fixture();f.edit();f.input('detailChoice','revisit');f.input('detailReason','최신 판단 이유');f.input('detailReview','2027-01-01');await f.submit();
  const reopened=fixture(f.persisted);reopened.edit();assert.deepEqual(reopened.values(),['revisit','최신 판단 이유','2027-01-01']);
});
test('save appends a verified immutable record and does not relink previous AI or comparison',async()=>{
  const old=saved('hold',{scenario_snapshot:{choice_comparison:{target_pct:10,reduce:{mode:'integer_shares'},price_assumptions:{down_pct:-10,up_pct:10}}}}),f=fixture([old]),snapshot=clone(f.persisted[0]);
  f.edit();f.input('detailReason','수정한 이유');await f.submit();assert.equal(f.persisted.length,2);assert.deepEqual(f.persisted[1],snapshot);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].p_reason,'수정한 이유');for(const key of ['p_analysis_id','p_target_pct','p_down_pct','p_up_pct','p_observation_at'])assert.equal(f.calls[0][key],null,key);
  assert.equal(f.element('detailDecisionForm').hidden,true);assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);f.edit();assert.equal(f.values()[1],'수정한 이유');
});
test('saved reduction choice keeps the requirement for a fresh executable comparison',async()=>{
  const f=fixture([saved('consider_reduction')]);f.edit();await f.submit();assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/수량 비교/);
});
test('current comparison state is untouched by saved-value prefill',()=>{
  const f=fixture(),comparison={targetPct:15};f.ctx.lastComparison=comparison;f.ctx.lastDetailAnalysisId='current-ai';f.ctx.lastAnalysisComparison=true;f.edit();
  assert.equal(f.ctx.lastComparison,comparison);assert.equal(f.ctx.lastDetailAnalysisId,'current-ai');assert.equal(f.ctx.lastAnalysisComparison,true);
});
test('a newer edit during save is preserved and remains dirty when opened again',async()=>{
  const f=fixture(),wait=deferred(),save=f.ctx.saveDecisionReceipt;f.edit();f.input('detailReason','제출한 이유');f.ctx.saveDecisionReceipt=async args=>{const receipt=await save(args);await wait.promise;return receipt};
  const pending=f.submit();f.input('detailReason','저장 중 새로 쓴 이유');wait.resolve();await pending;f.edit();
  assert.equal(f.persisted[0].reason,'제출한 이유');assert.equal(f.values()[1],'저장 중 새로 쓴 이유');assert.ok(f.ctx.detailDirtyGroups.detailDecisionForm);
});
test('failed save preserves edits and same request identity for retry',async()=>{
  const f=fixture();f.edit();f.input('detailReason','재시도할 이유');const write=f.ctx.saveDecisionReceipt;f.ctx.saveDecisionReceipt=async()=>{throw Error('offline')};
  await f.submit();const request=f.ctx.decisionRequestId;f.edit();assert.equal(f.values()[1],'재시도할 이유');assert.equal(f.element('detailDecisionForm').hidden,false);
  f.ctx.saveDecisionReceipt=write;await f.submit();assert.equal(f.calls[0].p_request_id,request);assert.match(f.element('detailDecisionStatus').textContent,/저장 완료/);
});
test('a stale asynchronous history response after close does not touch the form',async()=>{
  const f=fixture(),wait=deferred();f.ctx.rpc=()=>wait.promise;const pending=f.ctx.refreshDecisionReview();await Promise.resolve();await Promise.resolve();
  f.ctx.active=()=>false;wait.resolve([saved('revisit')]);await pending;assert.deepEqual(f.values(),['hold','','']);assert.equal(f.element('detailDecisionForm').hidden,true);
});
test('explicit edit can seed a pristine form opened by a generic action',()=>{
  const row=saved('revisit'),f=fixture([row]);f.ctx.openDecisionForm();f.edit();assert.deepEqual(f.values(),[row.choice,row.reason,row.review_condition]);
});
test('whitespace in a programmatic draft is preserved rather than treated as empty',()=>{
  const f=fixture();f.element('detailReason').value='  ';f.edit();assert.deepEqual(f.values(),['hold','  ','']);
});
test('unsupported historical choices cannot be assigned to the select',()=>{
  for(const choice of ['unknown','__proto__','toString']){const f=fixture([saved(choice)]);f.edit();assert.deepEqual(f.values(),['hold','','']);assert.equal(f.calls.length,0);}
});

test('manual checkpoint saves verbatim, confirms direct review, and reopens as an immutable record',async()=>{
  const old=saved('hold',{review_condition:'다음 실적 발표 때 확인'}),f=fixture([old]),prior=clone(f.persisted[0]);
  f.edit();assert.equal(f.values()[2],old.review_condition);f.input('detailReason','기대가 이어지는지 확인하려고');await f.submit();
  assert.equal(f.calls[0].p_review_condition,old.review_condition);assert.equal(f.persisted.length,2);assert.deepEqual(f.persisted[1],prior);
  assert.match(f.element('detailDecisionSummary').innerHTML,/저장 완료 · 직접 확인할 조건으로 기록했습니다/);
  const reopened=fixture(f.persisted);reopened.edit();assert.equal(reopened.values()[2],old.review_condition);
  const result=reopened.ctx.decisionConditionState(reopened.persisted[0],null,'2026-10-09',false);
  assert.equal(result.kind,'manual');assert.equal(result.hit,false);
});
test('cleared review text remains required and never writes a blank manual condition',async()=>{
  const f=fixture([saved('hold',{review_condition:'다음 실적 발표 때 확인'})]);f.edit();f.input('detailReview','   ');await f.submit();
  assert.equal(f.calls.length,0);assert.match(f.element('detailDecisionStatus').textContent,/내 이유와 다시 볼 조건을 적어/);
});
test('structured date keeps its own saved summary instead of a manual-review label',async()=>{
  const f=fixture([saved('hold',{review_condition:'2026-11-01'})]);f.edit();await f.submit();
  assert.match(f.element('detailDecisionSummary').innerHTML,/저장한 조건과 이후 자료/);
  assert.doesNotMatch(f.element('detailDecisionSummary').innerHTML,/직접 확인할 조건으로 기록했습니다/);
});

function reopenDraft(from,rows=[]){const f=fixture(rows);f.ctx.decisionDrafts=from.ctx.decisionDrafts;f.ctx.decisionDraftOwner=from.ctx.decisionDraftOwner;f.ctx.bindDecisionDraft();return f;}
test('unsaved decision survives leave and reopen without a database write',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.edit();f.input('detailChoice','revisit');f.input('detailReason','확인할 새 이유');f.input('detailReview','다음 공시');
 assert.equal(f.ctx.allowDetailLeave('discard?'),true);assert.equal(f.calls.length,0);
 const back=reopenDraft(f);assert.deepEqual(back.values(),['revisit','확인할 새 이유','다음 공시']);assert.equal(back.element('detailDecisionForm').hidden,false);assert.match(back.element('detailDecisionStatus').textContent,/아직 저장된 판단이 아닙니다/);assert.equal(back.calls.length,0);
 back.ctx.renderDecisionHistory([saved()]);back.edit();assert.deepEqual(back.values(),['revisit','확인할 새 이유','다음 공시']);
});
test('intentional empty values survive navigation',()=>{
 const f=fixture();f.ctx.bindDecisionDraft();f.edit();f.input('detailReason','');f.input('detailReview','');f.ctx.allowDetailLeave('discard?');const back=reopenDraft(f,[saved()]);back.edit();assert.deepEqual(back.values(),['pause_addition','','']);
});
test('different securities never share a draft',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','A only');f.ctx.allowDetailLeave('discard?');const other=fixture([]);other.ctx.id='other';other.ctx.decisionDrafts=f.ctx.decisionDrafts;other.ctx.decisionDraftOwner=1;other.ctx.bindDecisionDraft();assert.deepEqual(other.values(),['hold','','']);
});
test('a new authentication epoch clears retained drafts',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','private');f.ctx.allowDetailLeave('discard?');f.ctx.liveAuthEpoch=2;assert.equal(Object.keys(f.ctx.decisionDraftStore()).length,0);
});
test('saving in flight prevents navigation until the receipt is settled',async()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.edit();f.input('detailReason','reason');f.input('detailReview','2027-01-01');const wait=deferred(),write=f.ctx.saveDecisionReceipt;f.ctx.saveDecisionReceipt=async args=>{await wait.promise;return write(args)};const saving=f.submit();
 assert.equal(f.ctx.allowDetailLeave('discard?'),false);assert.match(f.element('detailDecisionStatus').textContent,/저장 결과를 확인 중/);wait.resolve();await saving;assert.equal(f.ctx.allowDetailLeave('discard?'),true);
});
test('verified save removes only that completed draft',async()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','reason');f.input('detailReview','2027-01-01');f.ctx.allowDetailLeave('discard?');f.ctx.decisionDrafts.other={values:{detailReason:'other'}};await f.submit();assert.equal(f.ctx.decisionDrafts.held,undefined);assert.ok(f.ctx.decisionDrafts.other);
});
test('editing during save retains the newer text for reopening',async()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','submitted');f.input('detailReview','2027-01-01');const wait=deferred(),write=f.ctx.saveDecisionReceipt;f.ctx.saveDecisionReceipt=async args=>{const r=await write(args);await wait.promise;return r};const saving=f.submit();f.input('detailReason','newer draft');wait.resolve();await saving;f.ctx.allowDetailLeave('discard?');const back=reopenDraft(f,f.persisted);assert.equal(back.values()[1],'newer draft');
});
test('restored comparison inputs never restore calculation or AI evidence',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','compare');f.element('detailWeightTarget').value='0';f.element('detailDown').value='-15';f.element('detailUp').value='12';f.ctx.lastDetailAnalysisId='old-ai';f.ctx.lastComparison={targetPct:0};f.ctx.allowDetailLeave('discard?');const back=reopenDraft(f);
 assert.equal(back.element('detailWeightTarget').value,'0');assert.equal(back.element('detailDown').value,'-15');assert.equal(back.element('detailUp').value,'12');assert.equal(back.ctx.lastComparison,null);assert.equal(back.ctx.lastDetailAnalysisId,null);assert.equal(back.ctx.lastComparisonDirty,true);assert.match(back.element('detailDecisionStatus').textContent,/다시 계산/);
});
test('failed plain save preserves its request identity across navigation',async()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','retry');f.input('detailReview','2027-01-01');f.ctx.saveDecisionReceipt=async()=>{throw Error('offline')};await f.submit();const request=f.ctx.decisionRequestId;f.ctx.allowDetailLeave('discard?');const back=reopenDraft(f);await back.submit();assert.equal(back.calls[0].p_request_id,request);
});
test('a confirmed formerly lost response is not restored as an unsaved draft',async()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','submitted');f.input('detailReview','2027-01-01');f.ctx.saveDecisionReceipt=async()=>{throw Error('lost')};await f.submit();f.ctx.allowDetailLeave('discard?');const row=saved('hold',{reason:'submitted',review_condition:'2027-01-01',request_id:f.ctx.decisionRequestId});const back=reopenDraft(f,[row]);assert.equal(back.element('detailDecisionForm').hidden,true);assert.equal(back.ctx.decisionDrafts.held,undefined);
});
test('other unfinished forms still require confirmation while decision draft is retained',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','retained');f.ctx.detailDirtyGroups.thesisForm=1;f.ctx.window.confirm=()=>false;assert.equal(f.ctx.allowDetailLeave('discard?'),false);assert.equal(f.ctx.decisionDrafts.held.values.detailReason,'retained');f.ctx.window.confirm=()=>true;assert.equal(f.ctx.allowDetailLeave('discard?'),true);
});
test('discarding a restored draft requires confirmation and never edits saved history',()=>{
 const f=fixture([]);f.ctx.bindDecisionDraft();f.input('detailReason','draft');f.input('detailReview','next');f.ctx.allowDetailLeave('discard?');const original=saved(),back=reopenDraft(f,[original]),before=clone(back.persisted);
 back.ctx.window.confirm=()=>false;back.element('detailDraftDiscard').onclick();assert.equal(back.values()[1],'draft');
 back.ctx.window.confirm=()=>true;back.element('detailDraftDiscard').onclick();assert.equal(back.ctx.decisionDrafts.held,undefined);assert.equal(back.element('detailDecisionForm').hidden,true);assert.equal(back.calls.length,0);assert.deepEqual(back.persisted,before);
 back.edit();assert.deepEqual(back.values(),[original.choice,original.reason,original.review_condition]);
});
