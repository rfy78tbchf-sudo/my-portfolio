import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function block(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`production block: ${start}`);
  return source.slice(a,b);
}
function fixture(){
  const c=vm.createContext({
    live:{},stockView:'total',stockPeriod:'THIS_MONTH',stockPnlSort:'impact',period:'오늘',
    esc:String,num:(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}),
    signedMoney:n=>`${n>0?'+':''}${Number(n).toLocaleString('en-US')}원`,cls:n=>n<0?'down':'up',
    stockMark:()=>'',stockViewButtons:()=>'',stockPeriodButtons:()=>'',stockPeriodLabel:()=> '이번 달',
    stockTotalPartsHtml:()=>'',kstStamp:()=>''
  });
  vm.runInContext(
    block('  function sortedStockPnl(', '  function stockPeriodLabel(')+
    block('  function stockPeriodPerformance(', '  function livePerformance(')+
    block('  function stockRealizedRows(', '  function saleReviewScope(')+
    block('  function stockSeparatedHtml(', "  var stockPeriod='THIS_MONTH'")+ 
    block('  function performanceReviewContext(', '  function compactDetailAnswer(')+
    block('  function reconciliationHomeStatus(', '  function homeAssetBasis('),c);
  return c;
}
const dates={period:'THIS_MONTH',period_start:'2026-10-01',period_end:'2026-10-19'};
const pending={symbol:'PENDING',name:'Synthetic pending',currency:'USD',pnl_krw:100,pnl_local:1,provisional_amount:true,pending_count:1,end_quantity:1};
const missing={symbol:'MISSING',currency:'USD',pnl_krw:null,pnl_local:null,reason:'결제 원장 연결 확인 필요',official_only:true,provisional_amount:true};
function periodResult(items=[pending,missing]){
  return {ok:true,...dates,pnl_krw:100,complete:false,krw_included_count:1,candidate_count:items.length,provisional_count:2,all_items_displayed:false,items:structuredClone(items)};
}
function hero(html){return html.match(/<section class="card performance-hero[^\"]*">[\s\S]*?<\/section>/)?.[0]||'';}
function leaders(html){return html.match(/<section class="card pnl-leaders">[\s\S]*?<\/section>/)?.[0]||'';}
function rowAmount(html,symbol){return html.match(new RegExp(`data-pnl-symbol="${symbol}"[\\s\\S]*?<strong[\\s\\S]*?<\\/strong>`))?.[0]||'';}

test('priced pending amounts stay provisional in summary, leader, row and review when another item is missing',()=>{
  const c=fixture(),p=periodResult();c.live.stockPnl=p;
  const before=JSON.stringify(p),html=c.stockPeriodPerformance();
  assert.match(hero(html),/일부 미계산/);
  assert.match(hero(html),/1\/2종목 · 추정 1종목 포함/);
  assert.doesNotMatch(hero(html),/추정 2종목/,'unpriced official-only entries are not included amounts');
  assert.match(leaders(html),/aria-label="PENDING \+100원 추정 종목 점검"/);
  assert.match(leaders(html),/<small class="partial-amount">추정<\/small>/);
  assert.match(rowAmount(html,'PENDING'),/\+100원<small class="partial-amount">추정/);
  assert.doesNotMatch(rowAmount(html,'MISSING'),/추정/,'an uncalculated amount stays uncalculated');
  const context=c.performanceReviewContext('PENDING');
  assert.equal(context.amount,100);assert.equal(context.currency,'KRW');
  assert.equal(context.partial,true);assert.equal(context.provisional,true);
  assert.match(c.performanceReviewHtml(context,'PENDING'),/일부 미계산 · 추정/);
  assert.equal(JSON.stringify(p),before,'rendering cannot recalculate amounts or change completeness');
});

test('zero, full calculation coverage and mixed currency retain their separate states',()=>{
  const c=fixture(),p=periodResult([{...pending,pnl_krw:0,pnl_local:0}]);
  Object.assign(p,{complete:true,pnl_krw:0,krw_included_count:1,provisional_count:1,all_items_displayed:true});
  c.live.stockPnl=p;let html=c.stockPeriodPerformance();
  assert.match(hero(html),/추정 1종목 포함/);assert.doesNotMatch(hero(html),/일부 미계산/);
  assert.match(rowAmount(html,'PENDING'),/0원<small class="partial-amount">추정/);
  assert.equal(p.complete,true,'coverage flag is not rewritten to infer settlement finality');
  const local={...pending,symbol:'LOCAL',pnl_krw:null,pnl_local:-2,local_cash_only:true,reason:'거래일 확인 필요'};
  c.live.stockPnl=periodResult([pending,local,missing]);html=c.stockPeriodPerformance();
  assert.match(hero(html),/전체 원화 합계는 아직 미확정/);
  assert.match(hero(html),/추정 2종목 포함/);
  assert.doesNotMatch(hero(html),/추정 3종목/);
  const context=c.performanceReviewContext('LOCAL');
  assert.equal(context.amount,-2);assert.equal(context.currency,'USD');assert.equal(context.provisional,true);
});

test('realized detail keeps the list currency, partial amount and provisional status without changing server values',()=>{
  const c=fixture();c.stockView='realized';c.live.stockRealizedPeriod=dates.period;
  const settled={symbol:'TEST',currency:'USD',realized_local:-10,historical_krw_estimate:12000,status:'calculated'};
  const r={ok:true,...dates,items:[settled]};c.live.stockRealized=r;
  let context=c.performanceReviewContext('TEST');
  assert.equal(context.amount,-10);assert.equal(context.currency,'USD');assert.equal(context.partial,false);
  assert.match(c.performanceReviewHtml(context,'TEST'),/-10.00 USD/);
  assert.doesNotMatch(c.performanceReviewHtml(context,'TEST'),/12,000원/,'opposite KRW sign must not silently replace the list amount');
  r.items.push({...settled,realized_local:null,historical_krw_estimate:null,status:'order_unverified'});
  context=c.performanceReviewContext('TEST');assert.equal(context.partial,true);assert.equal(context.amount,-10);
  r.items=[{...settled,realized_local:0,historical_krw_estimate:null}];
  context=c.performanceReviewContext('TEST');assert.equal(context.amount,0);assert.equal(context.partial,false);
  r.items=[{symbol:'TEST',currency:'USD',status:'settlement_pending',quantity:1,realized_local:null}];
  r.closed_cycles=[{symbol:'TEST',currency:'USD',aliases:['TEST'],closed_realized:{method:'flat_to_flat_net_cash',realized_local:-10,realized_krw:12000,sale_count:1,allocated_cost:100,provisional_settlement_count:1}}];
  const before=JSON.stringify(r);context=c.performanceReviewContext('TEST');
  assert.equal(context.amount,-10);assert.equal(context.provisional,true);assert.equal(context.partial,false);
  assert.match(c.performanceReviewHtml(context,'TEST'),/추정/);
  assert.match(hero(c.stockSeparatedHtml()),/추정 포함/);
  assert.equal(JSON.stringify(r),before);
});

test('quantity reconciliation reports only its scope and never treats zero coverage as normal',()=>{
  const c=fixture();c.live.reconciliationCases=[{status:'settlement_pending'}];
  c.live.reconciliation={ok:true,quantity_matched:13,quantity_total:13,missing_historical_fx_trades:4};
  let html=c.reconciliationHomeStatus();
  assert.match(html,/원장 수량 대조 · 13 \/ 13종목 일치/);assert.match(html,/1종목 결제 대기/);
  assert.doesNotMatch(html,/계좌 데이터 정상|성과.*완료/);
  c.live.reconciliation={ok:true,quantity_matched:0,quantity_total:0};html=c.reconciliationHomeStatus();
  assert.match(html,/원장 수량 대조 자료 없음/);assert.doesNotMatch(html,/✓|정상/);
  c.live.reconciliation={ok:true,quantity_matched:12,quantity_total:13};html=c.reconciliationHomeStatus();
  assert.match(html,/12 \/ 13종목 일치/);assert.doesNotMatch(html,/✓/);
  c.live.reconciliation={ok:true,quantity_matched:14,quantity_total:13};
  assert.match(c.reconciliationHomeStatus(),/자료 확인 필요/);
});
