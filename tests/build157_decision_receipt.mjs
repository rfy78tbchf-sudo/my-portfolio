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
assert.match(source,/verified\.reason!==reason/,'full content readback remains mandatory');
assert.match(source,/decisionRequestId=null;decisionRequestKey=null;renderDecisionHistory/,'only verified completion clears request');
console.log('Build157: lost receipt recovery, exact request/security identity, no write replay, full readback retained, auth isolation');
