import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  function changeStockPeriod('),source.indexOf('  function stockPeriodPerformance('));
const calls=[],pending={};let nested=false;
const previous={ok:true,period:'1W',pnl_krw:10,items:[]};
const c=vm.createContext({live:{stockPnlCacheDay:'2026-11-09',stockPnlCache:{},stockPnlRequests:{},stockPnl:previous,stockPnlPrevious:true},stockPeriod:'1W',stockPeriodEpoch:0,kstDate:()=> '2026-11-09',
 rpc(name,payload){calls.push(name);return new Promise(resolve=>{pending[name]=resolve})},
 render(){if(!nested&&c.live.stockPnlLoading){nested=true;c.rpc('get_live_realized_sales',{})}}
});
vm.runInContext(block,c);
const result=c.changeStockPeriod('1W',true);
assert.deepEqual(calls,['get_live_period_stock_pnl','get_live_realized_sales'],'retained result rendering cannot reserve the serial calculation ahead of the selected total');
assert.equal(c.live.stockPnlPrevious,true,'retained amount remains explicitly old');
const fresh={ok:true,period:'1W',pnl_krw:20,items:[]};pending.get_live_period_stock_pnl(fresh);await result;
assert.equal(c.live.stockPnl,fresh);assert.equal(c.live.stockPnlPrevious,false);assert.equal(c.live.stockPnlLoading,false);
await c.changeStockPeriod('1W',true);assert.equal(calls.length,2,'valid selected result remains reusable');
console.log('Build253: selected total precedes nested realized query; retained freshness and reuse preserved');
