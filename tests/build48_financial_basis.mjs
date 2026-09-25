import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function livePortfolio(){');
const end=html.indexOf('  function demoPerformance(){',start);
const id='sample',acct='broker',value=12_800_000,cost=13_100_000;
const context=vm.createContext({live:{accounts:[{id:acct,name:'자동계좌'}],
  holdings:[{account_id:acct,security_id:id,quantity:100,as_of:'2026-09-25',market_value:value,unrealized_pnl:123_456,fx_rate_to_base:1}],
  holdingBasis:[{account_id:acct,security_id:id,quantity:100,valuation_krw:value,cost_krw:cost,pnl_krw:value-cost,
    average_unit_krw:cost/100,valued_unit_krw:value/100,broker_pnl_differs:true}],
  snapshots:[{total_assets:20_000_000}],securityMap:{[id]:{symbol:'TST',name:'테스트용 매우 긴 해외 종목 이름(ADR)',market:'NASDAQ'}},analysis:{items:[]}},
  hideZeroHoldings:false,portfolioMarket:'ALL',portfolioAccount:'ALL',portfolioSort:'value',
  kstDate:()=> '2026-09-25',kstStamp:x=>String(x).slice(0,10),marketGroup:()=> 'OVERSEAS',
  money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>(Number(n)>0?'+':'')+Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  pct:n=>(Number(n)>0?'+':'')+Number(n).toFixed(2)+'%',weightPct:n=>Number(n).toFixed(1)+'%',num:(n,d)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d}),
  cls:n=>Number(n)>=0?'up':'down',esc:String,Set});
vm.runInContext(html.slice(start,end),context);
let result=vm.runInContext('livePortfolio()',context);
assert.match(result,/12,800,000원/);
assert.match(result,/-300,000원 \(-2\.29%\)/);
assert.match(result,/앱 합산 자산 대비 64\.0%/);
assert.match(result,/원가단가 <b>131,000원/);
assert.match(result,/평가단가 <b>128,000원/);
assert.doesNotMatch(result,/123,456원/,'mismatched broker P&L cannot appear as same-basis P&L');
assert.match(result,/원가 기준 손익 · KB 값과 차이/);
context.live.holdingBasis=[];
result=vm.runInContext('livePortfolio()',context);
assert.match(result,/손익 확인 필요/,'failed basis load cannot reuse stale numbers');

const css=html.slice(html.indexOf('<style>'),html.indexOf('</style>'));
assert.match(css,/\.amount-atomic\{[^}]*white-space:nowrap/);
assert.match(css,/\.financial-row\{[^}]*grid-template-columns:minmax\(0,1fr\) max-content/);
assert.match(css,/@media\(max-width:530px\)\{\.financial-row\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(css,/\.periods>\.chip\{flex:0 0 auto/);
assert.match(html,/function amountHtml\(n\)/);
assert.match(html,/function flowBasisHtml\(\)/);
assert.match(html,/var perf=observedReady&&observed\.partial\?/);
assert.ok(html.includes("총자산 관측 · '+period"));
assert.match(html,/\+reconciliationHomeStatus\(\)\+flow\+homeBrowseCard\(securitiesValue,totalAssets\)/);
console.log('build48 source-linked valuation, flow labels and responsive amount layout passed');
