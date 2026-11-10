import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('      var pending=(live.settlementBasis');const end=source.indexOf('      body.innerHTML=',start);
assert.ok(start>0&&end>start);
const code=source.slice(start,end);
const render=basis=>{
 const ctx=vm.createContext({live:{settlementBasis:basis,accounts:[{id:'a',name:'Synthetic'}]},s:{symbol:'SYNTH',currency:'USD'},positions:[{account_id:'a'}],esc:String,num:String,kstStamp:String});
 vm.runInContext(code,ctx);return ctx.settlementDetails;
};
const row={account_id:'a',symbol:'SYNTH',currency:'USD',observed_at:'synthetic',effective_quantity:2,settled_quantity:1,pending_buy_quantity:1,pending_sell_quantity:0,quantity_identity_ok:true,evidence_status:'complete_row'};
assert.match(render([row]),/2주/);assert.match(render([row]),/\+1주/);
for(const evidence_status of ['missing','incomplete','complete_absent','cutoff_mismatch','holding_mismatch','quantity_unknown']){
 const html=render([{...row,evidence_status,effective_quantity:null,settled_quantity:null,pending_buy_quantity:null,pending_sell_quantity:null}]);
 assert.match(html,/결제 수량 자료 확인 필요/);assert.doesNotMatch(html,/null주|0주|보유수량은 이미 반영/);
}
assert.equal(render([{...row,account_id:'other'}]),'');assert.equal(render([{...row,currency:'KRW'}]),'');
assert.equal(render([{...row,pending_buy_quantity:0,pending_sell_quantity:0}]),'');
assert.match(source,/quantity_identity_ok,currency,evidence_status,response_id/);
console.log('PASS actual detail renderer: verified pending quantities preserved; unknown explicit without zero; currency/account separation; settled-only stays compact');
