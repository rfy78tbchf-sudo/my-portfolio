import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp('));
let releaseCash,releaseExtra,calls=[],fail=false,day='2026-10-10';
const cash=new Promise(r=>releaseCash=r),extra=new Promise(r=>releaseExtra=r);
const c=vm.createContext({session:{accessToken:'synthetic'},live:null,liveError:null,liveLoadEpoch:0,liveAuthEpoch:1,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'1M',realizedPeriod:'1M',realizedAccount:'',periodTouched:false,realizedPeriodExplicit:false,compactMode:false,hideZeroHoldings:false,mode:'live',lastLiveLoadAt:0,applyUiSettings(){},render(){},checkPriceAlerts(){},loadSwingPrices:async()=>null,kstDate:()=>day,kstDaysAgo:()=>day,
 rest:async path=>path.startsWith('accounts?')?[{id:'a'}]:path.startsWith('daily_account_snapshots?')?[{total_assets:100,snapshot_date:day}]:[],
 rpc:async(name,p={})=>{calls.push([name,p.p_period]);if(name==='reconcile_live_cash_flows')return cash;if(name==='get_live_benchmark_comparison')return extra;if(name==='get_app_settings')return {home_period:'1W'};if(name==='get_live_home_chart'&&fail)throw Error('offline');return {ok:true,period:p.p_period,items:[]}}
});vm.runInContext(code,c);const tick=()=>new Promise(r=>setImmediate(r));
const loading=c.loadLiveOnce();await tick();assert.equal(c.live.accounts[0].id,'a');assert.equal(calls.some(x=>x[0]==='get_live_performance_summary'),false,'do not bypass reconciliation');
releaseCash({ok:true});await tick();assert.equal(c.live.performancePeriod,'1W','saved period restored');assert.equal(c.live.homeChart.period,'1W');assert.equal(c.live.performanceGate.period,'1W');assert.equal(c.live.todayGate.period,'오늘');assert.equal(c.live.detailsLoading,true,'home ready while auxiliary query blocked');
assert.equal(calls.filter(x=>x[0]==='get_live_home_chart').length,1,'reuse startup response in full bundle');
// A newer same-period user query must survive the initial enrichment completion.
c.performanceRequestEpoch++;c.live.performance={ok:true,marker:'newer'};c.live.homeChart={marker:'newer'};c.live.performanceGate={marker:'newer'};
releaseExtra({ok:true});await loading;assert.equal(c.live.performance.marker,'newer');assert.equal(c.live.homeChart.marker,'newer');assert.equal(c.live.performanceGate.marker,'newer');
calls=[];fail=true;await c.loadStartupHomeData(c.live,()=>true,c.period,c.performanceRequestEpoch);assert.equal(c.live.startupHomeError,true);assert.equal(c.live.performance.ok,true);assert.equal(c.live.homeChart,null);assert.equal(c.liveError,null);assert.equal(calls.length,4,'local retry only reads home data');
fail=false;await c.loadStartupHomeData(c.live,()=>true,c.period,c.performanceRequestEpoch);assert.equal(c.live.startupHomeError,false);
calls=[];c.period='오늘';await c.loadStartupHomeData(c.live,()=>true,c.period,c.performanceRequestEpoch);assert.equal(calls.filter(x=>x[0]==='get_live_reliable_performance').length,1,'today gate reused for today period');
const previous=c.live;
// Use independently resolvable requests to verify account/day and selection guards.
let resolves=[];c.rpc=()=>new Promise(r=>resolves.push(r));const stale=c.loadStartupHomeData(previous,()=>true,c.period,c.performanceRequestEpoch);c.live={};resolves.forEach(r=>r({ok:true}));await stale;assert.equal(c.live.performance,undefined);
c.live=previous;resolves=[];const midnight=c.loadStartupHomeData(previous,()=>true,c.period,c.performanceRequestEpoch);day='2026-10-11';resolves.forEach(r=>r({marker:'late'}));await midnight;assert.notEqual(c.live.performance?.marker,'late');
console.log('Build184: initial home before enrichment, reconciliation order, saved period, no duplicate core reads, retry, same-period epoch, account and midnight guards passed');
