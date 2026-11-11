import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');let requests=[],renders=0,today=0;
const c=vm.createContext({live:{stockPnlDeferred:true},period:'3M',stockPeriod:'THIS_MONTH',stockView:'realized',stockPnlQuery:'old search',stockPnlScope:'held',stockPnlSort:'loss',currentTab:'home',
 changeStockPeriod:p=>{requests.push(p);c.stockPeriod=p},render:()=>renders++,openTodayPerformance:()=>today++});
vm.runInContext(s.slice(s.indexOf('  function openHomePeriodPerformance('),s.indexOf('  function openTodayPerformance(')),c);
for(const period of ['1W','1M','3M','6M','YTD','1Y','ALL']){c.period=period;c.openHomePeriodPerformance();assert.equal(requests.at(-1),period);assert.equal(c.currentTab,'performance');assert.equal(c.stockView,'total');assert.equal(c.stockPnlQuery,'');assert.equal(c.stockPnlScope,'all');assert.equal(c.stockPnlSort,'impact');assert.equal(c.live.stockPnlDeferred,false)}
assert.equal(renders,7,'also renders when period loader reuses current result');c.period='오늘';c.openHomePeriodPerformance();assert.equal(today,1);assert.equal(requests.length,7);
c.live=null;c.openHomePeriodPerformance();assert.equal(today,1);
assert.match(s,/data-home-period-performance/);assert.match(s,/periodLink.onclick=openHomePeriodPerformance/);
console.log('Build198: selected home periods route to total stock contribution, reset stale filters, preserve today fast path and handle cached render');
