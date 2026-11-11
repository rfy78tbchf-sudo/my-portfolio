// Synthetic counterexample, not a broker parser or production calculation.
// Even assuming the undocumented timestamp means the last fill, an order
// summary does not uniquely determine moving-average realized P&L.
import assert from 'node:assert/strict';
const fill = (order, side, time, qty, price) => ({order,side,time,qty,price});
const a = [fill('B','buy','10:00:00',5,10),fill('S','sell','11:00:00',5,20),fill('B','buy','12:00:00',5,10)];
const b = [fill('S','sell','11:00:00',5,20),fill('B','buy','11:30:00',5,10),fill('B','buy','12:00:00',5,10)];
function summary(fills) {
  return ['B','S'].map(order => {
    const rows=fills.filter(x=>x.order===order),qty=rows.reduce((n,x)=>n+x.qty,0);
    return {order,side:rows[0].side,orderTime:'09:00:00',qty,
      price:rows.reduce((n,x)=>n+x.qty*x.price,0)/qty,
      lastFill:rows.map(x=>x.time).sort().at(-1)};
  });
}
function replay(fills) {
  let qty=10,cost=50,pnl=0;
  for(const x of fills) {
    if(x.side==='buy'){qty+=x.qty;cost+=x.qty*x.price;}
    else {assert.ok(qty>=x.qty);const basis=cost*x.qty/qty;pnl+=x.qty*x.price-basis;qty-=x.qty;cost-=basis;}
  }
  return {qty,cost,pnl};
}
assert.deepEqual(summary(a),summary(b));
const x=replay(a),y=replay(b);
assert.equal(x.qty,y.qty);
assert.ok(Math.abs(x.pnl-200/3)<1e-10);
assert.equal(y.pnl,75);
assert.notEqual(x.cost,y.cost);
console.log(JSON.stringify({identicalOrderSummaries:true,identicalClosingQuantity:true,
  possibleRealizedPnl:[x.pnl,y.pnl],conclusion:'Order summaries alone cannot prove fill chronology.'}));
