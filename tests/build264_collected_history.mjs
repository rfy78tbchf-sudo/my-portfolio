import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  var liveLoadPromise=null;'),html.indexOf('  function loadLiveOnce('))+html.slice(html.indexOf('  function runRefreshSync('),html.indexOf('  function refreshLive('));
const tick=()=>new Promise(r=>setImmediate(r));
for(const scenario of ['overlap','failed-read','owner-change','failed-collection','idle']){
 let stored=1,shown=1,loads=0,release;const controls=[];
 const c=vm.createContext({Date,Promise,mode:'live',session:{refreshToken:'synthetic-owner'},live:{},currentTab:'performance',recentHistoryMonths:()=>['2026-11'],kstMonth:()=> '2026-11',document:{getElementById:()=>({})},render(){},
 edgeSync:async()=>{if(scenario==='failed-collection')throw Error('synthetic source failure');stored=2},
 loadLiveOnce:async()=>{loads++;const snapshot=stored;if(loads===1&&scenario!=='idle')await new Promise((resolve,reject)=>{release=()=>scenario==='failed-read'?reject(Error('synthetic read failed')):resolve()});shown=snapshot}});
 vm.runInContext(source,c);
 let old;if(scenario!=='idle'){old=c.loadLive(false).catch(()=>null);await tick()}
 const collected=c.completeBackgroundSync(true,Date.now());await tick();
 if(scenario!=='idle'){
  assert.equal(loads,1,'do not overlap two account reads');
  if(scenario==='owner-change')c.session={refreshToken:'new-owner'};
  release();await old;
 }
 await collected;
 const fresh=['overlap','failed-read','idle'].includes(scenario);
 assert.equal(shown,fresh?2:1,scenario);
 assert.equal(loads,scenario==='idle'?1:fresh?2:1,scenario);
 assert.equal(c.backgroundSyncPromise,null);
}
console.log('Build264: fresh post-collection read, pending failure recovery, owner boundary, failed collection and idle request count passed');
