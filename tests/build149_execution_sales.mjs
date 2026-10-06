import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const s=fs.readFileSync('index.html','utf8'),c=vm.createContext({num:String,esc:String});
vm.runInContext(s.slice(s.indexOf('  function stockRealizedRows('),s.indexOf('  function saleReviewScope(')),c);
const data={ok:true,items:[{symbol:'ARM',currency:'USD',status:'settlement_pending',trade_date:'2026-10-05',settlement_date:'2026-10-07',quantity:18,realized_local:null},{symbol:'ARM',currency:'USD',status:'settlement_pending',trade_date:'2026-10-06',settlement_date:'2026-10-08',quantity:10,realized_local:null},{symbol:'SOXL',currency:'USD',status:'order_unverified',realized_local:null}]};
const rows=c.stockRealizedRows(data);assert.equal(rows.length,2);assert.equal(rows[0].count,2);assert.equal(rows[0].pending,2);assert.equal(rows[0].amount,null);assert.equal(rows[0].known,0);assert.match(c.stockRealizedEvidenceHtml(rows[0]),/2026-10-07/);assert.match(c.stockRealizedEvidenceHtml(rows[0]),/18주/);
// A period aggregate cannot erase additional unposted executions.
data.closed_cycles=[{symbol:'ARM',aliases:['ARM'],closed_realized:{method:'flat_to_flat_net_cash',realized_local:20,realized_krw:20000,sale_count:1}}];assert.equal(c.stockRealizedItems(data).length,3);
Object.assign(c,{stockView:'realized',stockPeriod:'THIS_MONTH',live:{stockRealized:{...data,period_start:'2026-10-01',period_end:'2026-10-06',pending_settlement_count:2},stockRealizedPeriod:'THIS_MONTH'},stockViewButtons:()=>'',stockPeriodButtons:()=>'',stockPeriodLabel:()=> '이번 달',stockMark:()=>'',brokerDayCard:()=>'',cls:()=>'',signedMoney:String});
vm.runInContext(s.slice(s.indexOf('  function stockSeparatedHtml('),s.indexOf("  var stockPeriod='THIS_MONTH'")),c);
const html=c.stockSeparatedHtml();assert.match(html,/매도 3건 · 2종목/);assert.match(html,/결제 반영 대기/);assert.doesNotMatch(html,/계산 대기|일부 계산/);
console.log('Build149: pending sales grouped, dates visible, no fake zero, no unsafe closed-cycle replacement, render passed');

const official={symbol:'KR',currency:'KRW',status:'broker_official',realized_local:155770,allocated_cost:2250000,quantity:200,trade_date:'2026-10-06'};
c.live.stockRealized={ok:true,items:[official,{symbol:'US',currency:'USD',realized_local:123.45,historical_krw_estimate:null,allocated_cost:1000}],period_start:'2026-10-01',period_end:'2026-10-06'};
const useful=c.stockSeparatedHtml();assert.match(useful,/123.45 USD/);assert.match(useful,/155770/);assert.match(useful,/sale-row-details/);assert.doesNotMatch(useful,/secondary full[^>]*data-sale-review/);
assert.equal(c.stockRealizedItems({items:[official],closed_cycles:[{symbol:'KR',aliases:['KR'],closed_realized:{method:'flat_to_flat_net_cash',sale_count:1,realized_local:9,realized_krw:9}}]})[0].realized_local,155770);
console.log('Build150: native USD without FX, official KRW, collapsed review and official priority passed');
