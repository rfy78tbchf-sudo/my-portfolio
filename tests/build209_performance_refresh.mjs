import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const day='2026-10-19',pnl={ok:true,period:'THIS_MONTH',period_start:'2026-10-01',period_end:day,pnl_krw:1234,complete:false,items:[]};
const realized={ok:true,period:'THIS_MONTH',period_start:'2026-10-01',period_end:day,items:[]};
function fixture(overrides={}){
  const previous={authOwner:1,accounts:[{id:'a'}],stockPnl:pnl,stockPnlCacheDay:day,stockRealized:realized,stockRealizedPeriod:'THIS_MONTH',stockRealizedDay:day,...overrides};
  const renders=[],calls=[];let releaseDetails;
  const c=vm.createContext({Date,live:previous,session:{},liveAuthEpoch:1,liveLoadEpoch:0,performanceRequestEpoch:0,realizedRequestEpoch:0,stockPeriodEpoch:0,stockRealizedEpoch:0,stockPeriod:'THIS_MONTH',period:'1M',mode:'live',kstDate:()=>day,
    rest:async path=>path.startsWith('accounts?')?[{id:'a'}]:path.startsWith('daily_account_snapshots?')?[{total_assets:5678}]:[],
    rpc:async name=>name==='get_live_current_account_scope'?null:new Promise((resolve,reject)=>calls.push({name,resolve,reject})),render:keep=>renders.push(keep)});
  vm.runInContext(block('  function loadLiveOnce(', '  function showApp('),c);
  vm.runInContext(block('  function changeStockPeriod(', '  function stockPeriodPerformance('),c);
  vm.runInContext(block('  function loadStockRealized(', '  function stockUnrealizedRows('),c);
  c.loadLiveDetails=()=>new Promise(resolve=>{releaseDetails=resolve});
  return {c,previous,renders,calls,release:()=>releaseDetails()};
}
const f=fixture(),load=f.c.loadLiveOnce();await tick();
assert.equal(f.c.live.snapshots[0].total_assets,5678);
assert.equal(f.c.live.stockPnl,pnl);assert.equal(f.c.live.stockPnlPrevious,true);assert.equal(f.c.live.stockRealized,realized);assert.equal(f.c.live.stockRealizedPrevious,true);
assert.deepEqual(Object.keys(f.c.live.stockPnlCache),[],'new balances never borrow the old calculation cache');
f.release();await load;
const recalc=f.c.changeStockPeriod('THIS_MONTH',true);assert.equal(f.c.live.stockPnl,pnl);assert.equal(f.c.live.stockPnlLoading,true);assert.equal(f.renders.at(-1),true);
f.calls[0].resolve({...pnl,pnl_krw:2222});await recalc;assert.equal(f.c.live.stockPnl.pnl_krw,2222);assert.equal(f.c.live.stockPnlPrevious,false);assert.equal(f.c.live.stockPnl.complete,false,'partial result stays partial');assert.equal(f.renders.at(-1),true);
f.c.loadStockRealized();assert.equal(f.c.live.stockRealized,realized);assert.equal(f.c.live.stockRealizedLoading,true);f.calls[1].resolve({...realized,fresh:true});await tick();assert.equal(f.c.live.stockRealized.fresh,true);assert.equal(f.c.live.stockRealizedPrevious,false);

const failed=fixture(),failedLoad=failed.c.loadLiveOnce();await tick();failed.release();await failedLoad;
let request=failed.c.changeStockPeriod('THIS_MONTH',true);failed.calls[0].reject(Error('offline'));await request;
assert.equal(failed.c.live.stockPnl,pnl);assert.equal(failed.c.live.stockPnlFailed,true);assert.equal(failed.c.live.stockPnlPrevious,true);
request=failed.c.changeStockPeriod('THIS_MONTH',true);failed.calls[1].resolve({...pnl,pnl_krw:3333});await request;assert.equal(failed.c.live.stockPnlPrevious,false);
failed.c.loadStockRealized();failed.calls[2].reject(Error('offline'));await tick();assert.equal(failed.c.live.stockRealized,realized);assert.equal(failed.c.live.stockRealizedFailed,true);
failed.c.loadStockRealized();assert.equal(failed.calls.length,3,'failed retained result does not retry during every render');failed.c.loadStockRealized(true);failed.calls[3].resolve(realized);await tick();assert.equal(failed.c.live.stockRealizedPrevious,false);

for(const overrides of [{authOwner:2},{accounts:[{id:'other'}]},{stockPnlCacheDay:'2026-10-18',stockRealizedDay:'2026-10-18'},{stockPnl:{...pnl,period:'ALL'},stockRealizedPeriod:'ALL'}]){
  const x=fixture(overrides),pending=x.c.loadLiveOnce();await tick();assert.equal(x.c.live.stockPnl,null);assert.equal(x.c.live.stockRealized,undefined);x.release();await pending;
}
const different=fixture(),pending=different.c.loadLiveOnce();await tick();different.release();await pending;
const other=different.c.changeStockPeriod('ALL');assert.equal(different.c.live.stockPnl,null);assert.equal(different.c.live.stockPnlPrevious,false);different.calls[0].resolve({ok:true,period:'ALL'});await other;
for(const failedResponse of [false,true]){
  const midnight=fixture(),initial=midnight.c.loadLiveOnce();await tick();midnight.release();await initial;
  const old=midnight.c.changeStockPeriod('THIS_MONTH',true);midnight.c.kstDate=()=> '2026-10-20';
  if(failedResponse)midnight.calls[0].reject(Error('late offline'));else midnight.calls[0].resolve(pnl);
  await old;assert.equal(midnight.c.live.stockPnl,null);assert.equal(midnight.c.live.stockPnlLoading,false);assert.equal(midnight.c.live.stockPnlDeferred,true,'late prior-day response schedules current-day calculation');
  const fresh=midnight.c.changeStockPeriod('THIS_MONTH',true);midnight.calls[1].resolve({...pnl,period_end:'2026-10-20'});await fresh;assert.equal(midnight.c.live.stockPnl.period_end,'2026-10-20');
}
const lateSales=fixture(),initialSales=lateSales.c.loadLiveOnce();await tick();lateSales.release();await initialSales;
lateSales.c.loadStockRealized();lateSales.c.kstDate=()=> '2026-10-20';lateSales.calls[0].resolve(realized);await tick();
assert.equal(lateSales.c.live.stockRealizedLoading,false);assert.equal(lateSales.c.live.stockRealized,null);assert.equal(lateSales.c.live.stockRealizedPeriod,null,'a prior-day completion cannot leave the selected sales view loading forever');
assert.match(block('  function stockPeriodPerformance(', '  function legacyLivePerformance('),/이전 조회 · 최신 손익/);
assert.match(block('  function stockSeparatedHtml(', '  var stockPeriod='),/이전 조회 · 최신 매도 손익/);
console.log('Build209: selected performance retained during refresh/failure, explicit previous-state label, fresh recalculation, partial status, retry, current scroll and account/day/period isolation passed');
