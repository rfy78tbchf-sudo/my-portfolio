import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');
const load=source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp('));
const heavy=['get_live_period_stock_pnl','get_live_realized_sales','get_live_ledger_realized'];
for(const name of heavy)assert.ok(!load.includes("rpc('"+name+"'"),'initial batch must not request '+name);
assert.ok(load.indexOf("render(true)")<load.indexOf("rpc('get_live_flow_basis'"),'paint before secondary reads');
const bind=source.slice(source.indexOf('  function bindBrokerDay('),source.indexOf("    document.querySelectorAll('[data-stock-period]')",source.indexOf('  function bindBrokerDay(')))+'}';
const calls=[];const c=vm.createContext({live:{stockPnlDeferred:true},stockView:'total',stockPeriod:'ALL',changeStockPeriod:p=>calls.push(p)});vm.runInContext(bind,c);c.bindBrokerDay();c.bindBrokerDay();assert.deepEqual(calls,['ALL']);assert.equal(c.live.stockPnlDeferred,false);
for(const view of ['unrealized','realized']){c.live={stockPnlDeferred:true};c.stockView=view;c.bindBrokerDay();assert.equal(c.live.stockPnlDeferred,true);assert.equal(calls.length,1)}
const change=source.slice(source.indexOf('  function changeStockPeriod('),source.indexOf('  function stockPeriodPerformance('));
let finish;Object.assign(c,{stockView:'total',stockPeriod:'ALL',stockPeriodEpoch:0,render(){},rpc:()=>new Promise(r=>finish=r),kstDate:()=> '2026-10-06'});vm.runInContext(change,c);
c.live={stockPnlDeferred:true};const old=c.live,p=c.changeStockPeriod('ALL');assert.equal(old.stockPnlDeferred,false);c.live={stockPnlDeferred:true};finish({ok:true,period:'ALL'});await p;assert.equal(c.live.stockPnl,undefined,'old response must not enter new balance snapshot');
console.log('Build144: no heavy initial P&L, early paint, demand-only start, single start and stale-snapshot guard passed');
