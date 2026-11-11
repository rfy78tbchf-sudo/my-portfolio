// Execute the real app refresh functions against isolated synthetic services.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.BASELINE_HTML || new URL('../../index.html',import.meta.url),'utf8');
// Run against Build241 via BASELINE_HTML after the fix is applied.
const src=html.slice(html.indexOf('  function runRefreshSync('),html.indexOf('  (function bindPullToRefresh('));
for(let run=0;run<5;run++){
 let now=Date.parse('2026-10-31T02:00:00Z'),providerRevision=1,storedRevision=0,shownRevision=0;
 const calls=[],nodes={};
 class Clock extends Date {static now(){return now}}
 const c={Date:Clock,Promise,mode:'live',session:{refreshToken:'synthetic'},live:{},liveError:null,
  liveRefreshPromise:null,lastLiveLoadAt:0,currentTab:'profit',
  recentHistoryMonths:()=>['2026-09','2026-10'],kstMonth:()=> '2026-10',
  document:{visibilityState:'visible',getElementById:id=>nodes[id]??=( {textContent:'',classList:{add(){},remove(){}},setAttribute(){}})},
  setTimeout(){},render(){},
  edgeSync:async(action,p)=>{calls.push([action,p.month]);if(action==='sync-history-month'&&p.month==='2026-10')storedRevision=providerRevision},
  loadLive:async()=>{shownRevision=storedRevision;c.lastLiveLoadAt=now}};
 vm.createContext(c);vm.runInContext(src,c);
 await c.completeBackgroundSync();assert.equal(shownRevision,1);calls.length=0;
 // New broker history arrives one minute after the successful history fetch.
 now+=60000;providerRevision=2;
 await c.refreshLive(true,true);if(c.backgroundSyncPromise)await c.backgroundSyncPromise;
 assert.equal(calls.filter(x=>x[0]==='sync-current').length,1);
 assert.equal(calls.filter(x=>x[0]==='sync-history-month').length,0);
 assert.equal(shownRevision,1,'manual refresh has not fetched the new history');
 assert.equal(nodes.modeBadge.textContent,'동기화');
 const withinTtl=calls.length;calls.length=0;
 // Same provider data becomes visible only after the current-month TTL expires.
 now+=300001;
 await c.refreshLive(true,true);if(c.backgroundSyncPromise)await c.backgroundSyncPromise;
 assert.equal(calls.filter(x=>x[0]==='sync-history-month').length,1);
 assert.equal(shownRevision,2);
 console.log(JSON.stringify({run:run+1,withinTtl:{requests:withinTtl,historyRequests:0,newHistoryVisible:false},afterTtl:{requests:calls.length,historyRequests:1,newHistoryVisible:true}}));
}
