import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const source=fs.readFileSync(process.env.PNL_SOURCE||'index.html','utf8');
const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(delay=30){
 const calls=[];let active=0,maxActive=0;
 const c=vm.createContext({Promise,session:{},liveAuthEpoch:1,live:{},stockPeriod:'THIS_MONTH',stockPeriodEpoch:0,stockRealizedEpoch:0,render(){},kstDate:()=> '2030-01-10',rpcDirect(name,payload){calls.push(payload.p_period);active++;maxActive=Math.max(maxActive,active);return new Promise(resolve=>setTimeout(()=>{active--;resolve({ok:true,period:payload.p_period,complete:false,items:[{pnl:17,estimated:true}]})},delay))}});
 vm.runInContext(block('  var stockCalculationTail=','  function rpcDirect('),c);
 vm.runInContext(block('  function changeStockPeriod(','  function stockPeriodPerformance('),c);
 vm.runInContext(block('  function loadStockRealized(','  function stockUnrealizedRows('),c);
 return {c,calls,max:()=>maxActive};
}
const measurements=[];for(let i=0;i<7;i++){
 const f=fixture(),start=performance.now();const p=[f.c.changeStockPeriod('1W')];await tick();
 for(const period of ['1M','3M','6M','ALL'])p.push(f.c.changeStockPeriod(period));
 await Promise.all(p);measurements.push(performance.now()-start);
 assert.equal(f.c.live.stockPnl.period,'ALL');assert.equal(f.c.live.stockPnl.complete,false);assert.equal(f.max(),1);
 if(!process.env.PNL_BASELINE)assert.deepEqual(f.calls,['1W','ALL']);
 const n=f.calls.length;await f.c.changeStockPeriod('ALL');assert.equal(f.calls.length,n);
}
if(!process.env.PNL_BASELINE){
 const f=fixture(),a=f.c.changeStockPeriod('1W');await tick();const b=f.c.changeStockPeriod('1M'),c=f.c.changeStockPeriod('3M'),d=f.c.changeStockPeriod('1M');await Promise.all([a,b,c,d]);assert.deepEqual(f.calls,['1W','1M']);assert.equal(f.c.live.stockPnl.period,'1M');
 const g=fixture(),first=g.c.changeStockPeriod('1W');await tick();const old=g.c.changeStockPeriod('ALL');g.c.live={};await Promise.all([first,old]);assert.deepEqual(g.calls,['1W']);assert.equal(g.c.live.stockPnl,undefined);
 const h=fixture(),start=h.c.changeStockPeriod('1W');await tick();h.c.loadStockRealized();const end=h.c.changeStockPeriod('ALL');h.c.loadStockRealized();await Promise.all([start,end]);await h.c.stockCalculationTail;assert.deepEqual(h.calls,['1W','ALL','ALL']);assert.equal(h.c.live.stockRealized.period,'ALL');
 const k=fixture(),oldDay=k.c.changeStockPeriod('1W');await tick();const queued=k.c.changeStockPeriod('ALL');k.c.kstDate=()=> '2030-01-11';await Promise.all([oldDay,queued]);assert.deepEqual(k.calls,['1W']);assert.equal(k.c.live.stockPnlDeferred,true);
}
measurements.sort((a,b)=>a-b);console.log(JSON.stringify({mode:process.env.PNL_BASELINE?'before':'after',runs:7,syntheticServiceDelayMs:30,medianMs:measurements[3],minMs:measurements[0],maxMs:measurements[6],note:'Node VM request-to-state timing, not browser paint or production RPC latency'}));
