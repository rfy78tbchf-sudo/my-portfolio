import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),c=vm.createContext({money:n=>n+'원',price:(n,u)=>n+' '+u});
vm.runInContext(html.slice(html.indexOf('  function portfolioAverageText('),html.indexOf('  function livePortfolio(')),c);
const n={source:'KB_SPQM2226_NATIVE',currency:'USD',quantity:4,average_price:115,market_price:100,observed_at:'2026-10-01T12:00:00Z'},h={currency:'USD',quantity:4,as_of:'2026-10-01T12:00:01Z',native_prices:n};
assert.equal(c.portfolioAverageText([h],'USD'),'평단 115 USD');
for(const patch of [{source:'bad'},{currency:'KRW'},{quantity:3},{average_price:0},{average_price:null},{observed_at:'2026-09-30T00:00:00Z'}])assert.equal(c.portfolioAverageText([{...h,native_prices:{...n,...patch}}],'USD'),'원본 외화 평단 확인 중');
assert.equal(c.portfolioAverageText([h,h],'USD'),'계좌별 평단 · 상세 보기');
assert.equal(c.portfolioAverageText([{currency:'KRW',avg_cost:10000}],'KRW'),'평단 10000원');
console.log('Build114: broker-native average, no synthetic FX average, multi-account and invalid evidence passed');
