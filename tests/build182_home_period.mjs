import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
let day='2026-10-10',calls=[],deferred={},fail=null,screens=[];
const c=vm.createContext({live:{performancePeriod:'1M'},period:'1M',realizedPeriod:'1M',realizedAccount:'',mode:'live',periodTouched:false,realizedPeriodExplicit:false,periodSettingWrite:Promise.resolve(),performanceRequestEpoch:0,realizedRequestEpoch:0,kstDate:()=>day,
 render:()=>screens.push([c.period,c.live.performancePeriod,c.live.realizedSalesLoading]),
 rpc:(name,p={})=>{calls.push([name,p.p_period]);if(name===fail)return Promise.reject(Error('offline'));if(name==='get_live_realized_sales')return new Promise(resolve=>{deferred[p.p_period]=resolve});return Promise.resolve({ok:true,period:p.p_period,items:[],period_start:day,period_end:day})},rest:()=>Promise.resolve([])});
vm.runInContext(html.slice(html.indexOf('  function loadPerformance(){'),html.indexOf('  function loadMoreData(')),c);
const tick=()=>new Promise(r=>setImmediate(r));
c.changePerformancePeriod('1W');await tick();
assert.equal(c.live.performancePeriod,'1W');assert.equal(c.live.realizedSalesLoading,true);
assert.ok(screens.some(x=>x[0]==='1W'&&x[1]==='1W'&&x[2]),'home becomes readable before sales response');
deferred['1W']({ok:true});await tick();
c.changePerformancePeriod('3M');await tick();deferred['3M']({ok:true});await tick();
const summaryCount=()=>calls.filter(x=>x[0]==='get_live_performance_summary').length;
const before=summaryCount();c.changePerformancePeriod('1W');await tick();assert.equal(summaryCount(),before,'successful revisit needs no summary request');deferred['1W']({ok:true});await tick();
day='2026-10-11';await c.loadPerformance();assert.equal(summaryCount(),before+1,'KST midnight invalidates');
c.live={};await c.loadPerformance();assert.equal(summaryCount(),before+2,'fresh account snapshot invalidates');
fail='get_live_home_chart';c.changePerformancePeriod('6M');await tick();assert.ok(c.live.performanceError);assert.notEqual(c.live.performancePeriod,'6M');
fail=null;c.changePerformancePeriod('6M');await tick();assert.equal(c.live.performancePeriod,'6M','same-period retry works');assert.equal(c.live.performanceError,null);deferred['6M']({ok:true});await tick();
let release;const priorRpc=c.rpc;c.rpc=(name,p)=>name==='get_live_performance_summary'?new Promise(r=>release=r):priorRpc(name,p);
c.period='YTD';const first=c.loadPerformance(),second=c.loadPerformance();release({ok:true});await Promise.all([first,second]);assert.equal(c.live.performancePeriod,'YTD','pending duplicate shares request');
c.period='ALL';const stale=c.loadPerformance();c.live={};release({ok:true});assert.equal(await stale,null,'old account response cannot apply');assert.equal(c.live.performance,undefined);
c.rpc=priorRpc;c.period='1W';fail='get_live_ledger_realized';await c.loadPerformance();assert.equal(c.live.performanceCache['1W'],undefined,'optional failure is not cached');fail=null;await c.loadPerformance();assert.ok(c.live.performanceCache['1W']);
console.log('Build182: home independent of sales, period reuse, midnight/account invalidation, failure retry, pending deduplication and stale-response isolation passed');
