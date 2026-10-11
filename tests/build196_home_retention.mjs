import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
let day='2026-10-11',failed=new Set(),empty=false;
const c=vm.createContext({live:{},mode:'live',period:'1M',performanceRequestEpoch:1,kstDate:()=>day,render(){},
  rpc:async(name,p)=>{if(failed.has(name))throw Error('offline');return empty?null:{source:name,period:p.p_period,value:100}}
});
vm.runInContext(source.slice(source.indexOf('  function loadStartupHomeData('),source.indexOf('  function loadHomeReviewData(')),c);
const load=()=>c.loadStartupHomeData(c.live,()=>true,c.period,c.performanceRequestEpoch);
await load();const chart=c.live.homeChart;
failed.add('get_live_home_chart');await load();
assert.equal(c.live.homeChart,chart,'same-day same-period confirmed chart survives failed refresh');
assert.equal(c.live.startupHomeError,true);assert.ok(c.live.startupHomeRetained.includes('자산 추이'));
failed=new Set(['get_live_home_chart','get_live_performance_summary','get_live_reliable_performance']);
const gate=c.live.performanceGate,today=c.live.todayGate;await load();
assert.equal(c.live.performanceGate,gate);assert.equal(c.live.todayGate,today);assert.equal(c.live.performance.value,100);
c.period='3M';await load();assert.equal(c.live.homeChart,null,'never borrow chart from another period');assert.equal(c.live.performanceGate,null);assert.equal(c.live.todayGate,today,'today is independent of selected period');
day='2026-10-12';await load();assert.equal(c.live.todayGate,null,'never present prior-day today result as current');assert.equal(c.live.startupHomeRetained.length,0);
failed.clear();await load();assert.equal(c.live.startupHomeError,false);assert.equal(c.live.homeChart.period,'3M');assert.equal(c.live.startupHomeRetained.length,0);
empty=true;await load();assert.equal(c.live.homeChart,null,'successful empty result is not a transport failure');assert.equal(c.live.performanceGate,null);assert.equal(c.live.startupHomeError,false);
console.log('Build196: confirmed value retention, field failure labels, period/day isolation, successful recovery and successful-empty response passed');
