import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const s=fs.readFileSync('index.html','utf8');
const c=vm.createContext({liveAuthEpoch:1,session:{accessToken:'test'}});
vm.runInContext(s.slice(s.indexOf('  var liveReadQueue='),s.indexOf('  function rest(')),c);
const started=[],release=[];let running=0,max=0;
const job=n=>()=>new Promise(resolve=>{started.push(n);running++;max=Math.max(max,running);release[n]=()=>{running--;resolve(n)}});
const pending=[0,1,2,3,4].map(n=>c.queueLiveRead(job(n)));
const urgent=c.queueLiveRead(job(5),true);
await new Promise(r=>setImmediate(r));assert.deepEqual(started,[0,1,2]);
release[0]();await new Promise(r=>setImmediate(r));assert.deepEqual(started,[0,1,2,5]);
release[1]();release[2]();release[5]();await new Promise(r=>setImmediate(r));
release[3]();release[4]();await Promise.all([...pending,urgent]);assert.equal(max,3);
// A queued read from a logged-out user must never execute under the new account.
const holds=[6,7,8].map(n=>c.queueLiveRead(job(n)));let staleStarted=false;
const stale=c.queueLiveRead(()=>{staleStarted=true});const rejected=assert.rejects(stale,/AUTH_REQUIRED/);
await new Promise(r=>setImmediate(r));c.liveAuthEpoch++;release[6]();release[7]();release[8]();
await Promise.all([...holds,rejected]);assert.equal(staleStarted,false);
console.log('Build156: max three reads, interactive priority, queued account isolation');
