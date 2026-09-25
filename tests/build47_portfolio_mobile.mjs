import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function livePortfolio(){');
const end=html.indexOf('  function demoPerformance(){',start);
assert.ok(start>0&&end>start);
const accountA='kb',accountB='isa',security='kodex';
const sample={accounts:[{id:accountA,name:'KB증권'},{id:accountB,name:'KB증권 ISA · 수동'}],
  holdings:[
    {account_id:accountB,security_id:security,quantity:210,as_of:'2026-09-23T03:35:38Z',avg_cost:11376,market_price:11354,market_value:2384270,unrealized_pnl:-4690,unrealized_pnl_rate:-.20,currency:'KRW',fx_rate_to_base:1},
    {account_id:accountA,security_id:security,quantity:200,as_of:'2026-09-25T12:35:33Z',avg_cost:11251,market_price:11305,market_value:2261000,unrealized_pnl:10890,unrealized_pnl_rate:.48,currency:'KRW',fx_rate_to_base:1}
  ],securityMap:{[security]:{symbol:'A0173Y0',name:'KODEX 미국AI광통신네트워크',market:'KRX',currency:'KRW'}},analysis:{items:[]}};
const context=vm.createContext({live:sample,hideZeroHoldings:false,portfolioMarket:'ALL',portfolioAccount:'ALL',portfolioSort:'value',
  kstDate:()=> '2026-09-25',kstStamp:x=>String(x).slice(0,10),
  marketGroup:()=> 'KR',money:n=>Number(n).toLocaleString('en-US')+'원',
  signedMoney:n=>(n>0?'+':'')+Number(n).toLocaleString('en-US')+'원',
  pct:n=>(n>0?'+':'')+Number(n).toFixed(2)+'%',num:(n,d)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d}),
  cls:n=>Number(n)>=0?'up':'down',esc:String,Set});
vm.runInContext(html.slice(start,end),context);
let view=vm.runInContext('livePortfolio()',context);
assert.equal((view.match(/data-security-id="kodex"/g)||[]).length,1,'same security must render once');
assert.match(view,/410주/);
assert.match(view,/4,645,270원/);
assert.match(view,/\+6,200원/);
assert.match(view,/2개 계좌/);
assert.match(view,/2026-09-23 기준 · 새 잔고 확인 필요/);
assert.doesNotMatch(view,/KB 평균매입단가/);
assert.ok(html.includes('padding-bottom:calc(124px + var(--safe))'));
context.portfolioAccount=accountA;
view=vm.runInContext('livePortfolio()',context);
assert.match(view,/200주/);
assert.match(view,/2,261,000원/);
assert.match(view,/KB증권/);
assert.doesNotMatch(view,/410주/);
console.log('build47 account grouping, valuation and mobile spacing passed');
