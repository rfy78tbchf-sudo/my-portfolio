// Execute the real app refresh functions against isolated synthetic services.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
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
 assert.equal(calls.filter(x=>x[0]==='sync-history-month').length,2);
 assert.equal(shownRevision,2,'manual refresh fetches newly arrived history within the TTL');
 assert.equal(nodes.modeBadge.textContent,'동기화');
 const withinTtl=calls.length;calls.length=0;
 // Same provider data becomes visible only after the current-month TTL expires.
 now+=300001;
 await c.refreshLive(true,true);if(c.backgroundSyncPromise)await c.backgroundSyncPromise;
 assert.equal(calls.filter(x=>x[0]==='sync-history-month').length,2);
 assert.equal(shownRevision,2);
 console.log(JSON.stringify({run:run+1,withinTtl:{requests:withinTtl,historyRequests:2,newHistoryVisible:true},afterTtl:{requests:calls.length,historyRequests:2,newHistoryVisible:true}}));
}
// A manual request arriving during an older history fetch waits, then refreshes
// only sources whose successful request began before that manual request.
{
 let now=10000000,calls=[],release,fail=false;
 class Clock extends Date {static now(){return now}}
 const c={Date:Clock,Promise,mode:'live',session:{refreshToken:'owner'},live:{},
  recentHistoryMonths:()=>['2026-09','2026-10'],kstMonth:()=> '2026-10',
  document:{getElementById:()=>({})},loadLive:async()=>{},render(){},
  edgeSync:async(a,p)=>{calls.push([a,p.month]);if(calls.length===1)await new Promise(r=>release=r);if(fail&&p.month==='2026-10')throw Error('synthetic offline')}};
 vm.createContext(c);vm.runInContext(src.slice(0,src.indexOf('  function refreshLive(')),c);
 const old=c.completeBackgroundSync();await Promise.resolve();now+=100;
 const first=c.completeBackgroundSync(true,now),second=c.completeBackgroundSync(true,now);
 release();await Promise.all([old,first,second]);
 assert.equal(calls.filter(x=>x[1]==='2026-09').length,2);
 assert.equal(calls.filter(x=>x[1]==='2026-10').length,1);
 assert.equal(calls.filter(x=>x[0]==='sync-prices').length,1);
 const successfulStart=c.backgroundHistoryStarts['history:2026-10'];
 now+=100;fail=true;await c.completeBackgroundSync(true,now);
 assert.equal(c.backgroundHistoryStarts['history:2026-10'],successfulStart);
 fail=false;now+=100;await c.completeBackgroundSync(true,now);
 assert.equal(c.backgroundHistoryStarts['history:2026-10'],now);
 calls=[];await c.completeBackgroundSync();assert.equal(calls.length,0,'automatic refresh retains TTL');
 now+=100;c.backgroundSyncTimes={};
 const oldOwner=c.completeBackgroundSync();await Promise.resolve();now+=100;
 const queued=c.completeBackgroundSync(true,now);c.session={refreshToken:'different-owner'};
 release();await Promise.all([oldOwner,queued]);
 assert.equal(calls.length,1,'queued manual work is discarded when the session changes');
}
console.log('Build242: new history, in-flight sharing, failed-source retry and automatic TTL passed');
