import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');
const c=vm.createContext({session:{accessToken:'a'},setTimeout:fn=>fn()});
vm.runInContext(source.slice(source.indexOf('  function readFetch('),source.indexOf('  function rest(')),c);
let calls=0;c.authFetch=async()=>{if(++calls===1)throw Object.assign(new Error('aborted'),{name:'AbortError'});return 'ok'};
assert.equal(await c.readFetch('/read',{},9000),'ok');assert.equal(calls,2);
calls=0;c.authFetch=async()=>{calls++;throw Object.assign(new Error('aborted'),{name:'AbortError'})};await assert.rejects(c.readFetch('/read',{},9000));assert.equal(calls,2);
calls=0;c.authFetch=async()=>{calls++;return {status:403}};assert.equal((await c.readFetch('/read',{},9000)).status,403);assert.equal(calls,1);
calls=0;c.authFetch=async()=>{calls++;c.session=null;throw Object.assign(new Error('aborted'),{name:'AbortError'})};await assert.rejects(c.readFetch('/read',{},9000));assert.equal(calls,1);
// Full initial load: failed secondary reads must not hide successful account reads.
Object.assign(c,{session:{accessToken:"a"},liveLoadEpoch:0,liveAuthEpoch:0,live:null,liveError:null,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'오늘',realizedPeriod:'오늘',realizedAccount:'all',periodTouched:false,realizedPeriodExplicit:false,compactMode:false,hideZeroHoldings:false,applyUiSettings(){},kstDate:()=> '2026-10-10',kstDaysAgo:()=> '2026-09-01',lastLiveLoadAt:0,checkPriceAlerts(){},mode:'live',render(){},loadSwingPrices:async()=>null});
c.rest=async path=>path.startsWith('accounts?')?[{id:'account'}]:path.startsWith('holdings?')?[{quantity:1}]:[];
c.rpc=async name=>{if(name==='get_app_settings')return {};if(name==='reconcile_live_cash_flows')return {ok:true};throw new Error('secondary timeout')};
vm.runInContext(source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp(')),c);
await c.loadLiveOnce();assert.equal(c.live.accounts[0].id,'account');assert.equal(c.live.holdings[0].quantity,1);assert.equal(c.live.performance,null);assert.equal(c.liveError,null);
// Critical account failure is still reported, never fabricated as a successful empty account.
c.live=null;c.rest=async()=>{throw new Error('core unavailable')};await c.loadLiveOnce();assert.equal(c.liveError,'core unavailable');
console.log('Build153: bounded read retry, auth/session isolation, secondary failure isolation, critical failure preserved');

// Hold reconciliation unresolved: account rendering must precede auxiliary completion.
c.live=null;let release;const blocker=new Promise(r=>release=r);let paints=0;c.render=()=>paints++;
c.rest=async path=>path.startsWith('accounts?')?[{id:'early'}]:[];
c.rpc=async name=>name==='reconcile_live_cash_flows'?blocker:name==='get_app_settings'?{}:null;
const staged=c.loadLiveOnce();await new Promise(r=>setImmediate(r));
assert.equal(c.live.accounts[0].id,'early');assert.equal(c.live.detailsLoading,true);assert.ok(paints>0);
const sameTarget=c.live;release({ok:true});await staged;assert.equal(c.live,sameTarget);assert.equal(c.live.detailsLoading,false);
// A late completion from a logged-out session cannot publish private data.
c.live=null;let finishCore;const delayed=new Promise(r=>finishCore=r);c.rest=async()=>delayed;
const stale=c.loadLiveOnce();c.liveAuthEpoch++;c.session=null;finishCore([]);await stale;assert.equal(c.live,null);
console.log('Build155: first paint before reconciliation, stable target and logout isolation');

c.session={accessToken:'c'};const prior={accounts:[{id:'retained'}]};c.live=prior;c.rest=async()=>{throw new Error('offline')};await c.loadLiveOnce();assert.equal(c.live,prior);assert.equal(c.liveError,'offline');

// User opens performance while enrichment is still blocked. Its result survives.
c.live=null;c.rest=async path=>path.startsWith('accounts?')?[{id:'early'}]:[];
let releaseEnrichment;const enrichment=new Promise(r=>releaseEnrichment=r);
c.rpc=async name=>name==='reconcile_live_cash_flows'?enrichment:name==='get_app_settings'?{}:null;
const inFlight=c.loadLiveOnce();await new Promise(r=>setImmediate(r));
assert.equal(c.live.stockPnl,null,'core exposes on-demand performance immediately');
const calculated={ok:true,period:'THIS_MONTH',pnl_krw:123};
c.live.stockPnl=calculated;c.live.stockPnlDeferred=false;c.live.todayStocks={ok:true};
c.live.stockRealized={ok:true,items:[]};const realized=c.live.stockRealized;
releaseEnrichment({ok:true});await inFlight;
assert.equal(c.live.stockPnl,calculated);assert.equal(c.live.stockPnlDeferred,false);
assert.equal(c.live.stockRealized,realized);assert.equal(c.live.todayStocks.ok,true);
console.log('Build156: enrichment preserves demand-loaded period, realized and today results');
