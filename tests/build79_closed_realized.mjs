import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const s=fs.readFileSync('index.html','utf8'),ctx={num:String};vm.createContext(ctx);
vm.runInContext(s.slice(s.indexOf('  function stockRealizedRows('),s.indexOf('  function stockTotalPartsHtml(')),ctx);
const dates={period:'THIS_MONTH',period_start:'2026-09-01',period_end:'2026-09-29'};
const cycle={symbol:'ISIN',aliases:['ISIN','AAA'],name:'Closed fixture',currency:'USD',closed_realized:{method:'flat_to_flat_net_cash',sale_count:2,realized_local:-10,realized_krw:-14000,provisional_date_count:0}};
const r={...dates,ok:true,items:[{symbol:'AAA',currency:'USD',realized_local:5,historical_krw_estimate:7000},{symbol:'AAA',currency:'USD',realized_local:null},{symbol:'BBB',currency:'KRW',realized_local:500}],closed_cycles:[cycle]};
const rows=ctx.stockRealizedRows(r);assert.equal(rows.length,2);
const c=rows.find(x=>x.symbol==='ISIN');assert.equal(c.amount,-14000);assert.equal(c.count,2);assert.equal(c.known,2);assert.match(c.detail,/기간 합계/);
assert.equal(r.items.length,3);assert.equal(r.items[1].realized_local,null);
const p={...dates,pnl_krw:-20000,items:[{symbol:'ISIN',aliases:['AAA'],pnl_krw:-14000},{symbol:'BBB',pnl_krw:-6000}]};
assert.equal(ctx.stockTotalParts(p,r).realized,-13500);
assert.equal(ctx.stockRealizedItems({...r,closed_cycles:[{...cycle,closed_realized:{...cycle.closed_realized,sale_count:3}}]}).length,3);
assert.equal(ctx.stockRealizedItems({...r,closed_cycles:[{...cycle,closed_realized:{...cycle.closed_realized,realized_krw:null}}]}).length,3);
assert.equal(ctx.stockRealizedItems({...r,closed_cycles:[cycle,cycle]}).length,2);
const sql=fs.readFileSync('supabase/build79_closed_period_realized.sql','utf8');
for(const guard of ['c.start_qty=0 and c.end_qty=0 and c.pending_count=0','z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash',"a.user_id=(select auth.uid())","v_period->>'period_end'"])assert.ok(sql.includes(guard));
console.log('Build79: aggregate closed periods, no duplicate sale totals, unknown FX, alias and original-evidence preservation passed');
// Fully closed inventory: admissible execution orders change individual allocations,
// but cannot change total proceeds minus acquisition cash.
const trades=[{q:10,cash:-100},{q:10,cash:-200},{q:-10,cash:120},{q:-10,cash:250}];
function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t])):[[]]}
let validOrders=0;
for(const order of permutations(trades)){let qty=0,cost=0,realized=0,valid=true;for(const t of order){if(t.q>0){qty+=t.q;cost-=t.cash}else{if(qty < -t.q){valid=false;break}const alloc=cost*(-t.q)/qty;realized+=t.cash-alloc;cost-=alloc;qty+=t.q}}if(valid){validOrders++;assert.ok(Math.abs(realized-70)<1e-8);assert.equal(qty,0)}}
assert.ok(validOrders>1);
