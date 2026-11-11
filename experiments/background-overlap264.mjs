// Actual refresh and load coalescing functions; synthetic services, no network.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.UI_SOURCE||'index.html','utf8');
const load=html.slice(html.indexOf('  var liveLoadPromise=null;'),html.indexOf('  function loadLiveOnce('));
const sync=html.slice(html.indexOf('  function runRefreshSync('),html.indexOf('  (function bindPullToRefresh('));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const samples=[];
for(let run=0;run<3;run++){
 let stored=1,shown=1,loads=0,releases=[],entered;
 const hit=new Promise(r=>entered=r),nodes={};
 const c=vm.createContext({Date,Promise,mode:'live',session:{refreshToken:'synthetic'},live:{},liveError:null,liveRefreshPromise:null,lastLiveLoadAt:0,currentTab:'performance',
 document:{visibilityState:'visible',getElementById:id=>nodes[id]??={classList:{add(){},remove(){}},setAttribute(){}}},setTimeout(){},render(){},recentHistoryMonths:()=>['2026-11'],kstMonth:()=> '2026-11',
 edgeSync:async(a)=>{await sleep(10);if(a==='sync-history-month')stored=2},
 loadLiveOnce:async()=>{loads++;const snapshot=stored;entered();await new Promise(r=>releases.push(r));shown=snapshot}});
 vm.runInContext(load+sync,c);
 const start=performance.now(),manual=c.loadLive(false);await hit;
 const background=c.completeBackgroundSync(true,Date.now());await sleep(40);
 assert.equal(stored,2);assert.equal(loads,1);releases.shift()();await manual;
 await sleep(1);while(releases.length)releases.shift()();await background;
 samples.push({run,storedRevision:stored,shownRevision:shown,loads,ms:performance.now()-start});
}
const fixed=process.env.EXPECT_FIXED==='1';assert.ok(samples.every(s=>s.shownRevision===(fixed?2:1)));
console.log(JSON.stringify({scope:'isolated actual functions; synthetic 10ms edge responses, held account read; no browser paint timing',fixed,samples},null,2));
