import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function loadPerformance(){');
const end=html.indexOf('  function loadMoreData(',start);
assert.ok(start>0&&end>start);

const pending=new Map(),calls=[],screens=[];
function delayed(key){return new Promise(resolve=>pending.set(key,resolve))}
async function tick(){await new Promise(resolve=>setImmediate(resolve))}
const live={accounts:[{id:'broker',name:'KB 자동계좌'}],performancePeriod:'1M',
  realizedSalesPeriod:'1M',realizedSalesAccount:'',realizedSales:{period:'1M'}};
const scope={live,period:'1M',periodTouched:false,realizedPeriod:'1M',realizedAccount:'',realizedPeriodExplicit:false,
  periodSettingWrite:Promise.resolve(),performanceRequestEpoch:0,realizedRequestEpoch:0,mode:'live',liveError:null,
  Promise,Number,Date,console,
  render(){screens.push({selected:scope.period,loaded:scope.live.performancePeriod,
    sold:scope.live.realizedSalesPeriod})},
  rpc(name,params={}){calls.push({name,params});if(name==='get_live_performance_summary')
    return delayed('performance:'+params.p_period);
    if(name==='get_live_realized_sales')return delayed('sales:'+params.p_period+':'+(params.p_account||''));
    if(name==='get_live_flow_basis')return Promise.resolve({ok:true});
    return Promise.resolve({period:params.p_period,items:[]})},
  rest(){return Promise.resolve([])}
};
vm.createContext(scope);
vm.runInContext(html.slice(start,end),scope);

vm.runInContext("changePerformancePeriod('1W')",scope);
vm.runInContext("changePerformancePeriod('3M')",scope);
assert.equal(scope.periodTouched,true);
assert.deepEqual(screens.map(x=>[x.selected,x.loaded]),[['1W','1M'],['3M','1M']],
  'the loading view must not label old results with the new period');
assert.ok(calls.some(x=>x.name==='get_live_realized_sales'&&x.params.p_period==='3M'),
  'the selected performance period is also the default sold-trade period');
pending.get('performance:3M')({ok:true,period_start:'2026-06-27',period_end:'2026-09-27'});
pending.get('sales:3M:')({ok:true,period:'3M',items:[]});
await tick();
assert.equal(calls.filter(x=>x.name==='set_app_setting').at(-1).params.p_value,'3M',
  'the final selected period is the one saved for next visit');
assert.equal(scope.live.performancePeriod,'3M');
assert.equal(scope.live.realizedSalesPeriod,'3M');
assert.deepEqual(screens.at(-1),{selected:'3M',loaded:'3M',sold:'3M'});

pending.get('performance:1W')({ok:true,period_start:'2026-09-21',period_end:'2026-09-27'});
pending.get('sales:1W:')({ok:true,period:'1W',items:[]});
await tick();
assert.equal(scope.live.performancePeriod,'3M','late responses cannot replace the chosen period');
assert.equal(scope.live.realizedSalesPeriod,'3M','late sales cannot replace the chosen period');
assert.equal(screens.length,3,'late responses must not render stale data');

scope.realizedPeriod='THIS_MONTH';scope.realizedAccount='broker';
const oldSale=vm.runInContext('loadRealizedSales()',scope);
scope.realizedPeriod='1M';
const newSale=vm.runInContext('loadRealizedSales()',scope);
pending.get('sales:1M:broker')({ok:true,period:'1M'});
await newSale;
pending.get('sales:THIS_MONTH:broker')({ok:true,period:'THIS_MONTH'});
await oldSale;
assert.equal(scope.live.realizedSalesPeriod,'1M','the account detail filter also discards an old response');

const sales=readFileSync(new URL('../realized-sales-ui.js',import.meta.url),'utf8');
const ui={window:{}};vm.createContext(ui);vm.runInContext(sales,ui);
const rendered=ui.window.realizedSalesUi.section({accounts:[{id:'broker',name:'KB 자동계좌'}],
  realizedSales:{ok:true,period_start:'2026-06-27',period_end:'2026-09-27',items:[]},
  realizedSalesPeriod:'3M',realizedSalesAccount:''},'3M','');
assert.match(rendered,/<option value="3M" selected>최근 3개월<\/option>/);
assert.match(rendered,/2026-06-27 ~ 2026-09-27/);
console.log('Selected period, sold trades and late responses stay aligned across the same account scope');
