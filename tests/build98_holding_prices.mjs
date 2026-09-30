import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const c=vm.createContext({esc:String,money:v=>`${Math.round(v).toLocaleString('en-US')}원`,kstStamp:String});
vm.runInContext(html.slice(html.indexOf('  function holdingPriceSummaryHtml('),html.indexOf('  function decisionReviewHtml(')),c);
const render=c.holdingPriceSummaryHtml;
// Regression: actual ARM broker fields contain KRW-sized values despite security currency USD.
const p={account_id:'a',security_id:'s',currency:'USD',as_of:'2026-09-30',avg_cost:424339,market_price:396652};
const b={account_id:'a',security_id:'s',as_of:p.as_of,average_unit_krw:17822276/42,valued_unit_krw:16617416/42};
let out=render([p],[b],[],'USD');
assert.match(out,/원화 평균 매입단가<\/span><strong>424,340원/);
assert.match(out,/원화 평가단가<\/span><strong>395,653원/);
assert.doesNotMatch(out,/424,339 USD|396,652 USD|396,652원/);
assert.match(out,/실시간 호가는 아닙니다/);
for(const bases of [[],[{...b,as_of:'old'}],[{...b,account_id:'other'}],[{...b,security_id:'other'}]]){
 out=render([p],bases,[],'USD');assert.equal((out.match(/확인 중/g)||[]).length,2);assert.doesNotMatch(out,/424,340원/);
}
for(const value of [null,undefined,0,-1,NaN,Infinity,''])assert.match(render([p],[{...b,average_unit_krw:value}],[],'USD'),/원화 평균 매입단가<\/span><strong>확인 중/);
out=render([p,{...p,account_id:'b'}],[b,{...b,account_id:'b',average_unit_krw:500000}],[{id:'a',name:'첫 계좌'},{id:'b',name:'둘째 계좌'}],'USD');
assert.match(out,/첫 계좌/);assert.match(out,/둘째 계좌/);assert.match(out,/500,000원/);
out=render([{...p,currency:'KRW',avg_cost:11251,market_price:10980}],[],[],'KRW');
assert.match(out,/평균 매입가<\/span><strong>11,251원/);assert.match(out,/잔고 조회 가격<\/span><strong>10,980원/);
console.log('Build99: observed ARM unit regression, account/time isolation, missing basis and domestic prices passed');
