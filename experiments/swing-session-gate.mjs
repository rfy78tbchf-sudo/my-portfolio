// Isolated candidate gate; does not cache amounts or change production routing.
import assert from 'node:assert/strict';
function createGate(clock){let state;
 return {capture(owner){if(!state||state.owner!==owner)state={owner,unsupported:false,retryAt:0};return state},
 allowed(s){return s===state&&!s.unsupported&&clock()>=s.retryAt},
 fail(s,kind){if(s!==state)return;if(kind==='unsupported')s.unsupported=true;else s.retryAt=clock()+30000},
 clear(){state=undefined}};
}
let time=0;const gate=createGate(()=>time),a=gate.capture('a');
assert.equal(gate.allowed(a),true);gate.fail(a,'transient');assert.equal(gate.allowed(a),false);
time=29999;assert.equal(gate.allowed(a),false);time=30000;assert.equal(gate.allowed(a),true);
gate.fail(a,'unsupported');time+=100000;assert.equal(gate.allowed(a),false);
const b=gate.capture('b');assert.equal(gate.allowed(b),true);assert.equal(gate.allowed(a),false);
gate.fail(a,'unsupported');assert.equal(gate.allowed(b),true,'late old-owner failure cannot disable new owner');
gate.clear();const a2=gate.capture('a');assert.notEqual(a2,a);assert.equal(gate.allowed(a2),true);
gate.fail(a,'transient');assert.equal(gate.allowed(a2),true);
console.log(JSON.stringify({tests:'transient expiry, unsupported gate, owner change, logout/login and late response passed',limitation:'Gate removes repeat probes only; first failed refresh still incurs three extra requests. No browser or deployed speed claim.'}));
export {createGate};
