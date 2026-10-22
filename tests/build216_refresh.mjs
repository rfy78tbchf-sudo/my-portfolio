import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  var liveLoadPromise=null;'),source.indexOf('  function showApp('));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const calls=[];let release,fail=false;
 const wait=new Promise(r=>release=r);
 const c=vm.createContext({session:{},mode:'live',currentTab:'home',live:null,liveError:null,liveAuthEpoch:1,liveLoadEpoch:0,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'1M',periodTouched:false,realizedPeriod:'1M',realizedAccount:'ALL',realizedPeriodExplicit:false,lastLiveLoadAt:0,kstDate:()=> '2026-10-22',kstDaysAgo:()=> '2026-10-01',render(){},applyUiSettings(){},checkPriceAlerts(){},loadSwingPrices:async()=>{},
 rest:async path=>{const name=path.split('?')[0];calls.push(name);if(name==='transactions'&&fail)throw Error('offline');return name==='accounts'?[{id:'a'}]:name==='daily_account_snapshots'?[{snapshot_date:'2026-10-22',total_assets:100},{snapshot_date:'2026-10-21',total_assets:90}]:[]},
 rpc:async(name,p={})=>{calls.push(name);if(name==='get_live_benchmark_comparison')await wait;return name==='get_app_settings'?{}:name==='get_live_current_account_scope'?{ok:true,current_display_total:100}:{ok:true,period:p.p_period,items:[]}}});
 vm.runInContext(block,c);return {c,calls,release,set fail(x){fail=x}};
}
const f=fixture();await f.c.loadLiveOnce(true);
assert.equal(f.c.live.detailsDeferred,true);assert.equal(f.c.live.detailsLoading,false);assert.ok(f.c.lastLiveLoadAt>0);
for(const name of ['get_live_benchmark_comparison','get_live_technical_summary','get_live_dividend_history','get_live_reconciliation_report'])assert.ok(!f.calls.includes(name),'home does not request '+name);
assert.equal(f.c.live.performancePeriod,'1M');assert.equal(f.c.live.homeChart.ok,true);assert.equal(f.c.live.holdingBasis.length,0);assert.equal(f.calls.filter(n=>n==='reconcile_live_cash_flows').length,1);
const first=f.c.live.ensureDetails(),second=f.c.live.ensureDetails();assert.equal(first,second);await tick();assert.equal(f.calls.filter(n=>n==='get_live_benchmark_comparison').length,1);assert.equal(f.c.live.enrichmentLoading,true);
f.release();await first;assert.equal(f.c.live.detailsDeferred,false);assert.equal(f.c.live.ensureDetails,null);assert.equal(f.c.live.snapshots[0].total_assets,90);
const full=fixture();let completed=false;const p=full.c.loadLiveOnce(false).then(()=>completed=true);await tick();assert.equal(completed,false,'full callers still wait for requested analysis');full.release();await p;
const old=fixture();await old.c.loadLiveOnce(true);old.c.liveAuthEpoch++;const before=old.calls.length;await old.c.live.ensureDetails();assert.equal(old.calls.length,before,'old owner cannot start deferred reads');
const retry=fixture();await retry.c.loadLiveOnce(true);retry.fail=true;const failed=retry.c.live.ensureDetails();retry.release();await failed;assert.match(retry.c.live.enrichmentError,/offline/);const count=retry.calls.length;await retry.c.live.ensureDetails();assert.equal(retry.calls.length,count,'failed lazy request does not loop on every render');retry.fail=false;await retry.c.live.ensureDetails(true);assert.equal(retry.c.live.detailsDeferred,false);assert.equal(retry.c.live.snapshots[0].total_assets,90,'retry does not reverse the coherent history');
const changed=fixture();await changed.c.loadLiveOnce(true);const prior=changed.c.live,late=prior.ensureDetails();await tick();changed.c.liveLoadEpoch++;changed.c.live={marker:'new'};changed.release();await late;assert.equal(changed.c.live.marker,'new');assert.equal(changed.c.live.benchmark,undefined,'late analysis cannot overwrite new balances');
console.log('Build216: home completes without enrichment, single lazy request, full caller contract, error retry, ordering and account/load isolation passed');

const shared=fixture();const fast=shared.c.loadLive(true),all=shared.c.loadLive();assert.equal(shared.c.loadLive(),all);assert.equal(shared.c.loadLive(true),fast);await fast;let allDone=false;all.then(()=>allDone=true);await tick();assert.equal(allDone,false);shared.release();await all;assert.equal(shared.c.live.detailsDeferred,false);
