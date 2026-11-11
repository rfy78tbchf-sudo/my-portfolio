import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.PORTFOLIO_HTML||'index.html','utf8');
const source=html.slice(html.indexOf('  var liveLoadPromise=null;'),html.indexOf('  function loadLiveOnce('))+html.slice(html.indexOf('  function runRefreshSync('),html.indexOf('  (function bindPullToRefresh('));
const tick=()=>new Promise(r=>setImmediate(r));
for(const failure of [false,true]){
 let finish,stored=1,shown=0,reads=0;const calls=[],nodes={};
 const c=vm.createContext({Date,Promise,mode:'live',session:{refreshToken:'synthetic'},live:{},liveError:null,liveRefreshPromise:null,lastLiveLoadAt:0,currentTab:'performance',recentHistoryMonths:()=>['2026-11'],kstMonth:()=> '2026-11',document:{visibilityState:'visible',getElementById:id=>nodes[id]??={classList:{add(){},remove(){}},setAttribute(){}}},setTimeout(){},render(){},
 edgeSync:async action=>{calls.push(action);if(action==='sync-current'){if(failure)throw Error('synthetic broker failure')}else if(action==='sync-history-month')stored=2},
 loadLiveOnce:async()=>{reads++;const captured=stored;if(reads===1)await new Promise(r=>finish=r);shown=captured}});
 vm.runInContext(source,c);
 const first=c.refreshLive(true,true),duplicate=c.refreshLive(true,true);assert.equal(first,duplicate);await tick();
 assert.equal(calls[0],'sync-current');assert.ok(calls.includes('sync-history-month'),'history can start before ancillary account reads finish');assert.equal(reads,1,'post-collection read waits for the pending read');
 finish();await first;if(c.backgroundSyncPromise)await c.backgroundSyncPromise;
 assert.equal(shown,2);assert.equal(reads,2);assert.equal(calls.filter(x=>x==='sync-current').length,1);assert.equal(calls.filter(x=>x==='sync-history-month').length,1);
}
console.log('Build265: foreground-first ordering, early history collection, shared manual request, post-collection freshness, partial broker failure passed');
