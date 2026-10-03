import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const parts=html.slice(html.indexOf('  function stockTotalParts('),html.indexOf('  function stockCalculationHtml('));
const ctx=vm.createContext({});vm.runInContext(parts,ctx);
const p={period:'ALL',period_start:'2020-07-14',period_end:'2026-10-03',pnl_krw:100,calculation:{dividend_krw:5},items:[{symbol:'TEST',pnl_krw:100}]};
const r={ok:true,period:'ALL',period_start:'1900-01-01',period_end:p.period_end,items:[{symbol:'TEST',currency:'KRW',realized_local:20}]};
const result=ctx.stockTotalParts(p,r);
assert.equal(result.realized,20);assert.equal(result.remainder,75);
assert.equal(result.realized+result.dividend+result.remainder,result.total);
assert.equal(ctx.stockTotalParts(p,{...r,period_end:'2026-10-02'}),null);
assert.equal(ctx.stockTotalParts(p,{...r,period_start:'2021-01-01'}),null);
assert.equal(ctx.stockTotalParts({...p,period:'1M'},{...r,period:'1M'}),null);
assert.equal(ctx.stockTotalParts({...p,period_start:null},r),null);
assert.equal(ctx.stockTotalParts({...p,pnl_krw:'NaN'},r),null);
for(const bad of [null,'',' ',Infinity,'NaN']){
  assert.equal(ctx.stockTotalParts({...p,items:[{symbol:'TEST',pnl_krw:bad}]},r).realized,null);
  assert.equal(ctx.stockTotalParts(p,{...r,items:[{symbol:'TEST',currency:'KRW',realized_local:bad}]}).realized,null);
}
assert.equal(ctx.stockTotalParts({...p,items:[{symbol:'TEST',pnl_krw:100,reason:'pending'}]},r).realized,null);
assert.equal(ctx.stockTotalParts(p,{...r,items:[{symbol:'TEST',currency:'KRW',realized_local:null,coverage_count:3}]}).missing,3);

// Deterministic watchdog: timeout, late completion, retry and account/period races.
const requests=[],timers=new Map();let timerId=0;
const state={live:{},stockPeriod:'ALL',stockRealizedEpoch:0,render(){},
  setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},
  clearTimeout(id){timers.delete(id)},
  rpc(){return new Promise((resolve,reject)=>requests.push({resolve,reject}))}};
vm.createContext(state);
vm.runInContext(html.slice(html.indexOf('  function loadStockRealized('),html.indexOf('  function stockUnrealizedRows(')),state);
state.loadStockRealized();assert.equal(state.live.stockRealizedLoading,true);
[...timers.values()][0]();assert.equal(state.live.stockRealizedLoading,false);assert.equal(state.live.stockRealizedFailed,true);
requests[0].resolve(r);await new Promise(setImmediate);assert.equal(state.live.stockRealized,null);
state.loadStockRealized(true);requests[1].resolve(r);await new Promise(setImmediate);
assert.equal(state.live.stockRealized,r);assert.equal(state.live.stockRealizedFailed,false);assert.equal(timers.size,0);
state.loadStockRealized(true);state.stockPeriod='1M';state.loadStockRealized();
requests[2].resolve(r);await new Promise(setImmediate);assert.equal(state.live.stockRealized,null);
requests[3].reject(Error('offline'));await new Promise(setImmediate);assert.equal(state.live.stockRealizedLoading,false);
state.loadStockRealized(true);const replacement={};state.live=replacement;
requests[4].resolve(r);await new Promise(setImmediate);assert.deepEqual(replacement,{});assert.equal(timers.size,0);
console.log('Build119: all-history scope, subtotal validity, bounded loading, retry and stale responses passed');
