import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.PNL_SOURCE||'index.html','utf8');
const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let clock=100000,day='2030-01-10',renders=0,active=0,maxActive=0;const calls=[];
 class Clock extends Date{static now(){return clock}}
 const c=vm.createContext({Promise,Date:Clock,session:{},liveAuthEpoch:1,live:{},stockPeriod:'THIS_MONTH',stockPeriodEpoch:0,kstDate:()=>day,render(){renders++},rpcDirect(name,payload){active++;maxActive=Math.max(active,maxActive);return new Promise((resolve,reject)=>calls.push({period:payload.p_period,resolve(x){active--;resolve(x)},reject(){active--;reject(Error('synthetic timeout/failure'))}}))}});
 vm.runInContext(block('  var stockCalculationTail=','  function rpcDirect('),c);
 vm.runInContext(block('  function changeStockPeriod(','  var performanceAssetScope='),c);
 const response=(p,extra={})=>({ok:true,period:p,period_start:day,period_end:day,complete:false,pnl_krw:17,items:[{pnl:null,estimated:true}],reconciliation:{data_version:'v1'},...extra});
 return {c,calls,response,tick,advance:n=>clock+=n,setDay:d=>day=d,renders:()=>renders,max:()=>maxActive};
}
async function navigateAway(f){const a=f.c.changeStockPeriod('1W');await tick();const b=f.c.changeStockPeriod('ALL');return {a,b};}
{
 const f=fixture(),{a,b}=await navigateAway(f),before=f.renders();
 f.calls[0].resolve(f.response('1W'));await tick();await a;
 assert.equal(f.renders(),before,'obsolete result does not render');assert.equal(f.c.live.stockPnl,null);
 assert.equal(f.c.live.stockPnlCache['1W'].pnl_krw,17);const time=f.c.live.stockPnlCacheTimes['1W'];
 f.calls[1].resolve(f.response('ALL',{pnl_krw:29}));await b;
 f.advance(10000);await f.c.changeStockPeriod('1W');assert.equal(f.calls.length,2);assert.equal(f.c.live.stockPnlFetchedAt,time,'cache return must not renew freshness');
 assert.equal(f.c.live.stockPnl.complete,false);assert.equal(f.c.live.stockPnl.items[0].pnl,null);assert.equal(f.c.live.stockPnl.items[0].estimated,true);
 f.advance(20000);const expired=f.c.changeStockPeriod('1W');await tick();assert.equal(f.calls.length,3);f.calls[2].resolve(f.response('1W',{pnl_krw:31}));await expired;assert.equal(f.c.live.stockPnl.pnl_krw,31);assert.equal(f.max(),1);
}
for(const boundary of ['auth','day','snapshot']){
 const f=fixture(),{a,b}=await navigateAway(f),old=f.c.live;
 if(boundary==='auth')f.c.liveAuthEpoch++;if(boundary==='day')f.setDay('2030-01-11');if(boundary==='snapshot')f.c.live={};
 f.calls[0].resolve(f.response('1W'));await Promise.all([a,b]);
 assert.equal(old.stockPnlCache['1W'],undefined,boundary+' discards old cache');assert.equal(f.calls.length,1);
}
for(const invalid of [{ok:false},{period:'3M'}]){
 const f=fixture(),{a,b}=await navigateAway(f);f.calls[0].resolve(f.response('1W',invalid));await tick();await a;
 assert.equal(f.c.live.stockPnlCache['1W'],undefined);f.calls[1].resolve(f.response('ALL'));await b;
}
{
 const f=fixture(),{a,b}=await navigateAway(f);f.calls[0].reject();await tick();await a;assert.equal(f.c.live.stockPnlCache['1W'],undefined);
 f.calls[1].resolve(f.response('ALL'));await b;assert.equal(f.c.live.stockPnl.period,'ALL','rejection releases calculation queue');
 const retry=f.c.changeStockPeriod('1W');await tick();assert.equal(f.calls.length,3);f.calls[2].resolve(f.response('1W'));await retry;
}
{
 const f=fixture(),{a,b}=await navigateAway(f);f.calls[0].resolve(f.response('1W'));await tick();f.calls[1].resolve(f.response('ALL'));await Promise.all([a,b]);
 f.c.live.homeChart={reconciliation:{period:'1W',data_version:'v2'}};const retry=f.c.changeStockPeriod('1W');await tick();assert.equal(f.calls.length,3,'data-version change invalidates retained cache');f.calls[2].resolve(f.response('1W',{reconciliation:{data_version:'v2'}}));await retry;
}
{
 const f=fixture();const a=f.c.changeStockPeriod('오늘');await tick();const b=f.c.changeStockPeriod('ALL');f.calls[0].resolve(f.response('오늘',{period_start:'2030-01-09'}));await tick();assert.equal(f.c.live.stockPnlCache['오늘'],undefined);f.calls[1].resolve(f.response('ALL'));await Promise.all([a,b]);
}
{
 const f=fixture(),a=f.c.changeStockPeriod('1W');await tick();const b=f.c.changeStockPeriod('ALL'),back=f.c.changeStockPeriod('1W');
 f.calls[0].resolve(f.response('1W'));await Promise.all([a,b,back]);assert.equal(f.calls.length,1,'return before completion shares in-flight read');assert.equal(f.c.live.stockPnl.period,'1W');assert.equal(f.max(),1);
}
console.log('Build256 cache: obsolete render guard, freshness/TTL, auth/day/snapshot, wrong period/date, failure recovery, version invalidation, in-flight sharing and concurrency1 PASS');
