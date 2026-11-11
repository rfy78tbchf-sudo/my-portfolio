import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('  function loadPerformance(){'),html.indexOf('  function loadRealizedSales()'));
const coreNames=['get_live_performance_summary','get_live_home_chart','get_live_reliable_performance'];
let day='2026-10-10',calls=[],gates={},details={},failAux=false;
const c=vm.createContext({live:{benchmark:{period:'OLD'},performancePeriod:'1M'},period:'1W',mode:'live',performanceRequestEpoch:0,kstDate:()=>day,render(){},
 rpc(name,p={}){calls.push([name,p.p_period]);if(coreNames.includes(name))return new Promise((resolve,reject)=>gates[name+':'+p.p_period]={resolve,reject});if(name==='get_live_benchmark_comparison'){if(failAux)return Promise.reject(Error('auxiliary offline'));return new Promise(resolve=>details[p.p_period]=resolve)}return Promise.resolve({ok:true,period:p.p_period,items:[]})},rest:()=>Promise.resolve([])});
vm.runInContext(code,c);const tick=()=>new Promise(r=>setImmediate(r));
function releaseCore(p){for(const n of coreNames)gates[n+':'+p].resolve({ok:true,period:p,items:[]})}
let p=c.loadPerformance();assert.equal(calls.length,3,'only home-essential reads start first');releaseCore('1W');await tick();
assert.equal(c.live.performancePeriod,'1W');assert.equal(c.live.performanceGate.period,'1W');assert.equal(c.live.homeChart.period,'1W');assert.equal(c.live.benchmark,null,'old auxiliary values cleared before exposing new period');assert.equal(c.live.performanceDetailsLoading,true);assert.equal(c.live.performanceCache['1W'],undefined,'partial stage is not a full cache');
c.period='3M';const next=c.loadPerformance();releaseCore('3M');await tick();
c.period='1W';const revisit=c.loadPerformance();await tick();assert.equal(c.live.performancePeriod,'1W','pending revisit displays the already-ready core');
details['3M']({ok:true,period:'3M'});await next;assert.equal(c.live.benchmark,null,'late details cannot mix periods');
details['1W']({ok:true,period:'1W'});await Promise.all([p,revisit]);assert.equal(c.live.benchmark.period,'1W');assert.equal(c.live.performanceDetailsLoading,false);
failAux=true;c.period='YTD';p=c.loadPerformance();releaseCore('YTD');await p;assert.equal(c.live.performancePeriod,'YTD');assert.equal(c.live.performanceError,null);assert.equal(c.live.performanceDetailsError,true,'auxiliary failure remains separate');assert.equal(c.live.performanceCache.YTD,undefined);
failAux=false;c.period='ALL';p=c.loadPerformance();releaseCore('ALL');await tick();const old=c.live;c.live={};details.ALL({ok:true});await p;assert.equal(c.live.performance,undefined);assert.equal(old.benchmark,null,'account replacement rejects late details');
c.period='6M';p=c.loadPerformance();releaseCore('6M');await tick();day='2026-10-11';details['6M']({ok:true});assert.equal(await p,null,'midnight rejects late details');assert.equal(c.live.performanceCache['6M'],undefined);
console.log('Build183: priority core reads, readable home before extras, cleared old evidence, pending revisit, auxiliary failure and period/account/day isolation passed');
