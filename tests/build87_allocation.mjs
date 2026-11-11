import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync('index.html','utf8');
const c={live:{holdings:[{account_id:'x',security_id:'a',quantity:1},{account_id:'y',security_id:'a',quantity:2},{account_id:'x',security_id:'b',quantity:1}],holdingBasis:[{account_id:'x',security_id:'a',valuation_krw:200},{account_id:'y',security_id:'a',valuation_krw:100},{account_id:'x',security_id:'b',valuation_krw:100}],securityMap:{a:{name:'Alpha',symbol:'A'},b:{name:'Beta',symbol:'B'}}},esc:String,num:(n,d)=>n.toFixed(d),money:n=>n+'원'};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf("  var allocationScope="),source.indexOf('  function riskOverviewCard(')),c);
let a=c.allocationData(500);assert.equal(a.rows.length,2);assert.equal(a.rows[0].value,300);assert.equal(a.remainder,0);assert.equal(a.total,400);
let html=c.allocationCard(500);assert.match(html,/75.0%/);assert.doesNotMatch(html,/그 외 자산·차이/);assert.equal((html.match(/<circle /g)||[]).length,2);
c.allocationScope='stocks';a=c.allocationData(500);assert.equal(a.total,400);assert.equal(a.remainder,0);assert.match(c.allocationCard(500),/75.0%/);
c.live.holdingBasis[1].valuation_krw=null;a=c.allocationData(500);assert.equal(a.missing,1);assert.equal(a.known,100);assert.equal(a.rows.find(r=>r.id==='a').value,null);assert.match(c.allocationCard(500),/평가액 확인 필요/);
c.allocationScope='assets';assert.equal(c.allocationData(50).assets,false);assert.equal(c.allocationData(null).assets,false);assert.doesNotMatch(c.allocationCard(50),/NaN|Infinity/);
c.live.holdingBasis=[];assert.doesNotMatch(c.allocationCard(null),/NaN|Infinity/);
console.log('Build87: account aggregation, both denominators, residual, missing values and invalid totals passed');

// A genuinely shared, independently supplied cutoff permits the existing mode.
c.live.holdings=[{account_id:'x',security_id:'a',quantity:1},{account_id:'x',security_id:'b',quantity:1}];
c.live.holdingBasis=[{account_id:'x',security_id:'a',quantity:1,valuation_krw:300,as_of:'2030-01-01T00:00:00Z'},{account_id:'x',security_id:'b',quantity:1,valuation_krw:100,as_of:'2030-01-01T00:00:00Z'}];
c.live.accounts=[{id:'x',provider:'kb_securities',mode:'live',is_active:true}];
c.live.risk={as_of:'2030-01-01T00:00:00Z',valuation_time_aligned:true,official_assets_krw:500};
c.live.accountScope={account_identity_verified:true,broker_account_overlap_verified:true,current_primary_observed_at:'2030-01-01T00:00:00Z',current_isa_balance_effective_at:'2030-01-01T00:00:00Z',current_display_total:500};
a=c.allocationData(500);assert.equal(a.assets,true);assert.equal(a.remainder,100);assert.match(c.allocationCard(500),/60.0%/);
for(const [obj,key,bad] of [[c.live.accountScope,'current_isa_balance_effective_at','2029-12-31T00:00:00Z'],[c.live.accountScope,'account_identity_verified',false],[c.live.risk,'valuation_time_aligned',false],[c.live.holdingBasis[0],'quantity',2],[c.live.holdingBasis[0],'as_of',null],[c.live.accountScope,'current_display_total',600]]){
 const good=obj[key];obj[key]=bad;a=c.allocationData(500);assert.equal(a.assets,false);assert.equal(a.remainder,0);assert.equal(a.total,400);obj[key]=good;
}
console.log('Build274: mixed/unknown cutoff cannot manufacture residual; aligned basis and selected stocks mode retained');
