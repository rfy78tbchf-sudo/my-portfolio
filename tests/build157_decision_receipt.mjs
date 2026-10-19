import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');
const args={p_security_id:'s',p_request_id:'request'};
let writes=0,reads=0,rows=[{id:'saved',security_id:'s',request_id:'request'}];
const c=vm.createContext({liveAuthEpoch:1,session:{accessToken:'test'},encodeURIComponent,
 rpc:async()=>{writes++;throw Error('lost response')},
 rest:async path=>{reads++;assert.match(path,/request_id=eq.request&security_id=eq.s&limit=2$/);return rows}});
vm.runInContext(source.slice(source.indexOf('  async function saveDecisionReceipt('),source.indexOf('  function openSecurityDetail(')),c);
assert.equal((await c.saveDecisionReceipt(args)).id,'saved');assert.equal(writes,1,'no automatic write replay');
for(const invalid of [[],[rows[0],rows[0]],[{...rows[0],security_id:'other'}],[{...rows[0],request_id:'old'}]]){
 rows=invalid;await assert.rejects(c.saveDecisionReceipt(args));
 rows=[{id:'saved',security_id:'s',request_id:'request'}];
}
c.rpc=async()=>({ok:true,id:'normal'});const before=reads;assert.equal((await c.saveDecisionReceipt(args)).id,'normal');assert.equal(reads,before,'normal response needs no receipt lookup');
c.rpc=async()=>{c.liveAuthEpoch++;throw Error('lost')};await assert.rejects(c.saveDecisionReceipt(args),/AUTH_REQUIRED/);assert.equal(reads,before,'account change prevents recovery lookup');
c.rpc=async()=>{throw Error('lost')};c.rest=async()=>{c.liveAuthEpoch++;return rows};await assert.rejects(c.saveDecisionReceipt(args),/AUTH_REQUIRED/);
assert.match(source,/var saved=await saveDecisionReceipt\(args\)/);
vm.runInContext(source.slice(source.indexOf('  function decisionRowMatchesSubmission('),source.indexOf('  function readDecisionDraft(')),c);
const submitted={p_security_id:'s',p_request_id:'request',p_choice:'hold',p_reason:'원래 이유',p_review_condition:'다음 실적 확인',p_analysis_id:null,p_target_pct:null,p_down_pct:null,p_up_pct:null,p_observation_at:null};
const recorded={id:'saved',security_id:'s',request_id:'request',choice:'hold',reason:'원래 이유',review_condition:'다음 실적 확인',analysis_id:null,scenario_snapshot:{}};
assert.equal(c.decisionRowMatchesSubmission(recorded,submitted),true);
for(const field of ['id','security_id','request_id','choice','reason','review_condition','analysis_id']){
  assert.equal(c.decisionRowMatchesSubmission({...recorded,[field]:field==='id'?null:'different'},submitted),false,field+' must match the submitted receipt');
}
const comparisonArgs={...submitted,p_analysis_id:'analysis',p_target_pct:0,p_down_pct:-12.5,p_up_pct:17.5,p_observation_at:'2026-10-19T00:00:00Z'};
const comparison={target_pct:0,price_assumptions:{down_pct:-12.5,up_pct:17.5},observation_at:'2026-10-19T09:00:00+09:00',hold:{value_krw:10000},reduce:{mode:'integer_shares'}};
const comparisonRow={...recorded,analysis_id:'analysis',scenario_snapshot:{choice_comparison:comparison}};
assert.equal(c.decisionRowMatchesSubmission(comparisonRow,comparisonArgs),true,'zero target and equivalent observation timestamps are valid');
assert.equal(c.decisionRowMatchesSubmission({...recorded,scenario_snapshot:{choice_comparison:comparison}},submitted),false,'a plain judgment must not acquire a comparison');
for(const invalid of [{...comparison,target_pct:10},{...comparison,hold:null},{...comparison,reduce:{mode:'fractional'}},{...comparison,price_assumptions:{down_pct:-10,up_pct:17.5}},{...comparison,price_assumptions:{down_pct:-12.5,up_pct:20}},{...comparison,observation_at:'2026-10-18T00:00:00Z'}]){
  assert.equal(c.decisionRowMatchesSubmission({...comparisonRow,scenario_snapshot:{choice_comparison:invalid}},comparisonArgs),false,'all submitted comparison assumptions are verified');
}
const submitSource=source.slice(source.indexOf("      var decisionForm=document.getElementById('detailDecisionForm');"),source.indexOf('      var general='));
const verifiedAt=submitSource.indexOf('if(!decisionRowMatchesSubmission(verified,args))'),finishedAt=submitSource.indexOf('finishDecisionSubmission(submission)');
assert.ok(verifiedAt>=0&&finishedAt>verifiedAt,'the submitted identity and complete content are verified before clearing its draft');
console.log('Build157: lost receipt recovery, exact request/security identity, no write replay, full readback retained, auth isolation');
