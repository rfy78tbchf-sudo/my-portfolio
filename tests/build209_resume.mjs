import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const refresh=block('  function refreshLive(', '  (function bindPullToRefresh');
const resume=block('  var liveResumePending=', "  document.getElementById('refreshBtn').onclick=");
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(tab='home',now='2026-10-19T09:05:00+09:00',last='2026-10-19T09:00:00+09:00'){
  const events={},timers=[],reads=[],renders=[];let authReads=0,authReply=null,holdAuth=false,modalOpen=false;
  const button={setAttribute(){},classList:{add(){},remove(){}}};
  const listen=(name,fn)=>(events[name]||=[]).push(fn);
  const c=vm.createContext({Promise,Error,navigator:{onLine:true},mode:'live',currentTab:tab,session:{accessToken:'synthetic'},liveAuthEpoch:1,live:{accounts:[{id:'fixture'}]},liveError:null,
    lastLiveLoadAt:Date.parse(last),liveRefreshPromise:null,
    Date:class extends Date{static now(){return Date.parse(now)}},
    document:{visibilityState:'visible',activeElement:null,addEventListener:listen,getElementById:id=>id==='detailModal'?{classList:{contains:()=>!modalOpen}}:button},
    window:{scrollY:650,addEventListener:listen},setTimeout:fn=>{timers.push(fn)},
    ensureFreshSession(){authReads++;return holdAuth?new Promise(resolve=>{authReply=resolve}):Promise.resolve(c.session)},
    loadLive:()=>new Promise((resolve,reject)=>reads.push({resolve:()=>{c.lastLiveLoadAt=c.Date.now();resolve()},reject})),
    render:preserve=>renders.push({preserve,tab:c.currentTab,y:c.window.scrollY})});
  vm.runInContext(refresh+resume,c);
  return {c,reads,renders,timers,events,get authReads(){return authReads},set modal(value){modalOpen=value},set holdAuth(value){holdAuth=value},authReply:()=>authReply(c.session),fire:name=>Promise.all((events[name]||[]).map(fn=>fn())),flushTimers(){timers.splice(0).forEach(fn=>fn())}};
}

for(const tab of ['home','portfolio','performance'])for(const event of ['focus','visibilitychange','pageshow','online']){
  const f=fixture(tab),pending=f.fire(event);await tick();
  assert.equal(f.reads.length,1,`${event} refreshes ${tab}`);
  f.c.window.scrollY=780;f.reads[0].resolve();await pending;
  assert.deepEqual(f.renders,[{preserve:true,tab,y:780}]);
  assert.equal(f.c.currentTab,tab);
  await f.fire(event);assert.equal(f.reads.length,1,'quick healthy return does not reload');
}
for(const tab of ['home','portfolio','performance']){
  const f=fixture(tab,'2026-10-20T00:00:20+09:00','2026-10-19T23:59:40+09:00');
  const p=f.fire('pageshow');await tick();assert.equal(f.reads.length,1,'Korean date change crosses the actual resume event');f.reads[0].resolve();await p;
}
const storm=fixture('performance');storm.holdAuth=true;
const returns=['focus','visibilitychange','pageshow','online'].map(storm.fire);
assert.equal(storm.authReads,1,'one auth restoration for overlapping return events');
storm.authReply();await tick();assert.equal(storm.reads.length,1);storm.reads[0].resolve();await Promise.all(returns);

for(const blocked of ['detail','input']){
  const f=fixture('performance');if(blocked==='detail')f.modal=true;else f.c.document.activeElement={closest:()=>true,matches:()=>true};
  await f.fire('focus');assert.equal(f.reads.length,0,'no refresh can replace an open review or active form');assert.equal(f.c.liveResumePending,true);
  f.modal=false;f.c.document.activeElement=null;
  if(blocked==='detail')f.c.flushLiveResume();else await f.fire('focusout');
  f.flushTimers();await tick();assert.equal(f.reads.length,1,'refresh deferred until closing detail/ending input');f.reads[0].resolve();await tick();
  assert.equal(f.c.liveResumePending,false);
}
for(const state of ['hidden','offline','login','demo']){
  const f=fixture();if(state==='hidden')f.c.document.visibilityState='hidden';else if(state==='offline')f.c.navigator.onLine=false;else f.c.mode=state;
  await f.fire('pageshow');assert.equal(f.authReads,0);assert.equal(f.reads.length,0);
}
const changed=fixture();changed.holdAuth=true;const stale=changed.fire('focus');changed.c.liveAuthEpoch++;changed.authReply();await stale;assert.equal(changed.reads.length,0,'old login cannot start a new account refresh');
const failed=fixture(),first=failed.fire('online');await tick();failed.reads[0].reject(Error('synthetic offline'));await first;
assert.equal(failed.c.liveResumePending,true);const retry=failed.fire('online');await tick();assert.equal(failed.reads.length,2);failed.reads[1].resolve();await retry;
const other=fixture('more');await other.fire('pageshow');assert.equal(other.authReads,1);assert.equal(other.reads.length,0,'account refresh does not replace settings edits');
assert.ok(block('  function renderNav(', '  function bindAnnualGoal(').includes('resumeLiveView()'),'navigation into a core view also checks freshness');
assert.ok(block('  function closeSecurityDetail(', '  function performanceReviewContext(').includes('flushLiveResume()'),'detail close flushes the deferred resume');
console.log('Build209: real resume event wiring, three core tabs, Korean midnight, deduplication, input/detail deferral, retained current scroll, offline recovery and session isolation passed');
