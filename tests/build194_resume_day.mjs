import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
const refresh=source.slice(source.indexOf('  function refreshLive('),source.indexOf('  (function bindPullToRefresh'));
function fixture(now,last){
  let reads=0,renders=0,release;
  const button={setAttribute(){},classList:{add(){},remove(){}}};
  const c=vm.createContext({mode:'live',document:{visibilityState:'visible',getElementById:()=>button},
    Date:class extends Date{static now(){return Date.parse(now)}},lastLiveLoadAt:Date.parse(last),liveRefreshPromise:null,
    live:{confirmed:true},liveError:null,loadLive:()=>{reads++;return new Promise(r=>release=r)},render:()=>renders++});
  vm.runInContext(refresh,c);
  return {c,get reads(){return reads},get renders(){return renders},release:()=>release()};
}
const same=fixture('2026-10-11T23:59:30+09:00','2026-10-11T23:59:00+09:00');
await same.c.refreshLive(false);assert.equal(same.reads,0,'same-day quick return keeps fast path');
const midnight=fixture('2026-10-12T00:00:30+09:00','2026-10-11T23:59:30+09:00');
const pending=midnight.c.refreshLive(false);await Promise.resolve();
assert.equal(midnight.reads,1,'KST date change must refresh even within three minutes');
assert.equal(midnight.c.refreshLive(false),pending,'focus and visibility events share one request');
assert.equal(midnight.c.live.confirmed,true,'confirmed data stays while refreshing');
midnight.release();await pending;assert.equal(midnight.renders,1);
const utc=fixture('2026-10-12T09:00:30+09:00','2026-10-12T08:59:30+09:00');
await utc.c.refreshLive(false);assert.equal(utc.reads,0,'UTC midnight is not a Korean date change');
const clock=fixture('2026-10-12T12:00:00+09:00','2026-10-12T12:01:00+09:00');
const retry=clock.c.refreshLive(false);await Promise.resolve();assert.equal(clock.reads,1,'backwards device clock must not suppress refresh');clock.release();await retry;
const hidden=fixture('2026-10-12T00:00:30+09:00','2026-10-11T23:59:30+09:00');hidden.c.document.visibilityState='hidden';await hidden.c.refreshLive(false);assert.equal(hidden.reads,0);
console.log('Build194: Korean midnight refresh, same-day and UTC fast return, clock rollback, coalesced events, retained data and hidden-page guard passed');
