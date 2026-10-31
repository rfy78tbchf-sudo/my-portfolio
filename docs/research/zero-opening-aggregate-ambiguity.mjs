// Synthetic: zero opening and one aggregate buy row still do not prove
// per-fill price uniformity when the underlying fills are unavailable.
import assert from 'node:assert/strict';
const a=[['buy',5,8],['sell',5,20],['buy',5,12]];
const b=[['buy',5,12],['sell',5,20],['buy',5,8]];
function aggregate(rows){return ['buy','sell'].map(side=>{
 const r=rows.filter(x=>x[0]===side),quantity=r.reduce((s,x)=>s+x[1],0),amount=r.reduce((s,x)=>s+x[1]*x[2],0);
 return {side,quantity,amount,averagePrice:amount/quantity};
})}
function replay(rows){let quantity=0,cost=0,realized=0;
 for(const [side,q,p] of rows){if(side==='buy'){quantity+=q;cost+=q*p}else{
  assert.ok(quantity>=q,'no short position or fabricated opening lot');
  const allocated=cost*q/quantity;realized+=q*p-allocated;cost-=allocated;quantity-=q;
 }}return {quantity,cost,realized};}
assert.deepEqual(aggregate(a),aggregate(b));
assert.deepEqual(replay(a),{quantity:5,cost:60,realized:60});
assert.deepEqual(replay(b),{quantity:5,cost:40,realized:40});
// Completing the same remaining sale makes the entire flat-to-flat sum invariant.
assert.equal(replay([...a,['sell',5,20]]).realized,100);
assert.equal(replay([...b,['sell',5,20]]).realized,100);
console.log('Identical zero-opening aggregate rows: partial-sale P&L differs; complete flat-to-flat P&L agrees. Synthetic only.');
