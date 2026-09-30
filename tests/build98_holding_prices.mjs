import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const c=vm.createContext({esc:String,price:(v,u)=>`${v.toFixed(2)} ${u}`,money:v=>`${Math.round(v).toLocaleString('en-US')}원`,kstStamp:String});
vm.runInContext(html.slice(html.indexOf('  function holdingPriceSummaryHtml('),html.indexOf('  function decisionReviewHtml(')),c);
const render=c.holdingPriceSummaryHtml;
// Regression: actual ARM broker fields contain KRW-sized values despite security currency USD.
const p={account_id:'a',security_id:'s',currency:'USD',fx_rate_to_base:1358.4,as_of:'2026-09-30',avg_cost:424339,market_price:396652};
const b={account_id:'a',security_id:'s',as_of:p.as_of,average_unit_krw:17822276/42,valued_unit_krw:16617416/42};
let out=render([p],[b],[],'USD');
assert.match(out,/환산 평균 매입가<\/span><strong>312.38 USD/);
assert.match(out,/환산 평가단가<\/span><strong>291.26 USD/);
assert.doesNotMatch(out,/424,339 USD|396,652 USD|396,652원/);
assert.match(out,/실시간 호가는 아닙니다/);
for(const bases of [[],[{...b,as_of:'old'}],[{...b,account_id:'other'}],[{...b,security_id:'other'}]]){
 out=render([p],bases,[],'USD');assert.ok((out.match(/확인 중/g)||[]).length>=2);assert.doesNotMatch(out,/424,340원/);
}
for(const value of [null,undefined,0,-1,NaN,Infinity,''])assert.match(render([p],[{...b,average_unit_krw:value}],[],'USD'),/환산 평균 매입가<\/span><strong>확인 중/);
out=render([p,{...p,account_id:'b'}],[b,{...b,account_id:'b',average_unit_krw:500000}],[{id:'a',name:'첫 계좌'},{id:'b',name:'둘째 계좌'}],'USD');
assert.match(out,/첫 계좌/);assert.match(out,/둘째 계좌/);assert.match(out,/500,000원/);
out=render([{...p,currency:'KRW',avg_cost:11251,market_price:10980}],[],[],'KRW');
assert.match(out,/평균 매입가<\/span><strong>11,251원/);assert.match(out,/잔고 조회 가격<\/span><strong>10,980원/);
console.log('Build100: matched FX conversion, missing basis and domestic prices passed');

for(const fx of [null,undefined,0,-1,NaN,Infinity,'']){const missing=render([{...p,fx_rate_to_base:fx}],[b],[],'USD');assert.equal((missing.match(/<strong>확인 중/g)||[]).length,2);}
assert.match(render([p],[b],[],'USD'),/실제 외화 매수 평단과 다를 수/);
assert.match(render([{...p,currency:'JPY',fx_rate_to_base:9}],[b],[],'JPY'),/47148.88 JPY/);
assert.match(render([p],[b],[],'USD'),/1 USD = 1,358.4원/);
