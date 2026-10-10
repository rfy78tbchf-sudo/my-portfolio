import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
const source=fs.readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
const changed=source.includes('function loadHomeReviewData(');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(){
 let paints=[],start=performance.now(),failed=false,blocked=false,release;const wait=new Promise(r=>release=r);let calls=[];
 const decision={security_id:'s0',created_at:'2026-10-01T00:00:00Z',choice:'hold',reason:'synthetic',review_condition:'2026-10-09'};
 const c=vm.createContext({session:{accessToken:'test'},liveLoadEpoch:0,liveAuthEpoch:1,live:null,liveError:null,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'오늘',realizedPeriod:'오늘',realizedAccount:'all',periodTouched:false,realizedPeriodExplicit:false,compactMode:false,hideZeroHoldings:false,applyUiSettings(){},kstDaysAgo:()=> '2026-09-19',lastLiveLoadAt:0,checkPriceAlerts(){},mode:'live',render(){paints.push({at:performance.now()-start,review:!!c.live?.reviewDecisions?.length,core:!!c.live?.accounts?.length,refreshing:!!c.live?.homeReviewLoading})},loadSwingPrices:async()=>null});
 vm.runInContext(section('  var liveReadQueue=', '  function rest('),c);
 c.rest=path=>c.queueLiveRead(async()=>{calls.push(path.split('?')[0]);await delay(40);if(failed&&path.startsWith('investment_decisions'))throw Error('offline');
 if(path.startsWith('accounts?'))return [{id:'a'}];if(path.startsWith('securities?'))return [{id:'s0',symbol:'TEST'}];if(path.startsWith('holdings?'))return [{security_id:'s0',quantity:1}];
 if(path.startsWith('daily_account_snapshots'))return [{snapshot_date:'2026-10-09',total_assets:100}];
 if(path.startsWith('investment_decisions'))return [decision];if(path.startsWith('daily_security_prices'))return [{security_id:'s0',price_date:'2026-10-09',close:10,currency:'USD'}];return []});
 c.rpc=(name)=>c.queueLiveRead(async()=>{calls.push(name);await delay(name==='reconcile_live_cash_flows'?350:40);if(blocked&&name==='reconcile_live_cash_flows')await wait;return name==='get_app_settings'?{}:null});
 vm.runInContext(section('  function loadLiveOnce(', '  function showApp('),c);
 return {c,decision,get paints(){return paints},get calls(){return calls},reset(){paints=[];calls=[];start=performance.now()},fail(){failed=true},block(){blocked=true},release};
}
const timings={network:'synthetic: 40ms/read, 350ms reconciliation, actual 3-read queue; not live API/iPhone latency'};
const f=fixture();await f.c.loadLiveOnce();timings.first_open_ms={account:Math.round(f.paints.find(x=>x.core).at),reviews:Math.round(f.paints.find(x=>x.review).at)};
f.reset();await f.c.loadLiveOnce();timings.refresh_ms={account:Math.round(f.paints.find(x=>x.core).at),reviews:Math.round(f.paints.find(x=>x.review).at),fresh_reviews:Math.round(f.paints.find(x=>x.review&&!x.refreshing).at)};
const reopened=fixture();await reopened.c.loadLiveOnce();timings.full_reopen_ms={account:Math.round(reopened.paints.find(x=>x.core).at),reviews:Math.round(reopened.paints.find(x=>x.review).at)};
if(changed){assert.ok(f.paints.every(x=>x.review),'refresh must not blank confirmed reviews');assert.equal(f.calls.filter(x=>x==='investment_decisions').length,1,'no duplicate lane requests');
 const g=fixture();g.block();const pending=g.c.loadLiveOnce();await delay(400);assert.ok(g.c.live?.reviewDecisions.length,'home is ready while reconciliation remains blocked');g.release();await pending;
 g.fail();await g.c.loadLiveOnce();assert.ok(g.c.live.reviewDecisions.length,'failed refresh retains confirmed decisions');assert.match(g.c.live.homeReviewError,/판단/);
 g.reset();await g.c.loadHomeReviewData(g.c.live,()=>true);assert.equal(g.calls.length,3,'local retry only reads three review sources');
 const target=g.c.live;g.reset();g.c.rest=async()=>{throw Error('core offline')};await g.c.loadLiveOnce();assert.equal(g.c.live,target);assert.equal(g.c.liveError,'core offline');
 const h=fixture();await h.c.loadLiveOnce();h.c.liveAuthEpoch++;h.fail();await h.c.loadLiveOnce();assert.equal(h.c.live.reviewDecisions.length,0,'different login never retains former owner review');
 // Resolve a separate explicit late request without private publication.
 const j=fixture();await j.c.loadLiveOnce();let releases=[];j.c.rest=()=>new Promise(r=>releases.push(r));let active=true;const late=j.c.loadHomeReviewData(j.c.live,()=>active);active=false;releases.forEach(r=>r([]));await late;assert.ok(j.c.live.reviewDecisions.length);
}
const resume=vm.createContext({mode:'live',document:{visibilityState:'visible'},liveRefreshPromise:null,lastLiveLoadAt:Date.now(),Date,Promise});
vm.runInContext(section('  function refreshLive(', '  (function bindPullToRefresh'),resume);
let at=performance.now();await resume.refreshLive(false);timings.resume_within_3min_ms=+(performance.now()-at).toFixed(2);
let periodCalls=0;const periods=vm.createContext({stockPeriod:'ALL',stockPeriodEpoch:0,live:{},kstDate:()=> '2026-10-10',render(){},rpc:async(_,p)=>{periodCalls++;await delay(40);return {ok:true,period:p.p_period}}});
vm.runInContext(section('  function changeStockPeriod(', '  function stockPeriodPerformance('),periods);
at=performance.now();await periods.changeStockPeriod('THIS_MONTH');timings.first_period_ms=+(performance.now()-at).toFixed(2);await periods.changeStockPeriod('ALL');at=performance.now();await periods.changeStockPeriod('THIS_MONTH');timings.cached_period_ms=+(performance.now()-at).toFixed(2);assert.equal(periodCalls,2);
console.log('Build180 controlled timings '+JSON.stringify(timings));
