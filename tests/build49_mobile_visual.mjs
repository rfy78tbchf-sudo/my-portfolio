import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
const start=source.indexOf('  function livePortfolio(){');
const end=source.indexOf('  function demoPerformance(){',start);
const account='sample-auto';
const sample={accounts:[{id:account,name:'자동계좌'}],holdingBasis:[],holdings:[],
  snapshots:[{total_assets:100_000_000}],securityMap:{},settlementBasis:[]};
for(let i=0;i<6;i++){
  const id='sample-'+i,quantity=100+i,value=19_300_000+i*1_111_111,cost=value+300_000;
  sample.securityMap[id]={name:i===0?'개인정보가 없는 긴 예시 해외 반도체 및 기술 투자 종목(ADR)':'예시 종목 '+i,symbol:'TEST'+i,market:'NASDAQ'};
  sample.holdings.push({account_id:account,security_id:id,quantity,as_of:'2026-09-25T13:00:00Z'});
  sample.holdingBasis.push({account_id:account,security_id:id,quantity,valuation_krw:value,cost_krw:cost,
    pnl_krw:value-cost,average_unit_krw:cost/quantity,valued_unit_krw:value/quantity});
}
const ctx=vm.createContext({live:sample,hideZeroHoldings:false,portfolioMarket:'ALL',portfolioAccount:'ALL',portfolioSort:'value',
  kstDate:()=> '2026-09-25',kstStamp:x=>String(x).slice(0,10),marketGroup:()=> 'OVERSEAS',
  money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>(n>0?'+':'')+Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  pct:n=>(n>0?'+':'')+Number(n).toFixed(2)+'%',weightPct:n=>Number(n).toFixed(1)+'%',
  num:(n,d)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d}),cls:n=>n>=0?'up':'down',esc:String,Set});
vm.runInContext(source.slice(start,end),ctx);
const portfolio=vm.runInContext('livePortfolio()',ctx);
assert.equal((portfolio.match(/class="row holding portfolio-row clickable"/g)||[]).length,6);
const doc=`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}\nbody{margin:0}.test-nav{position:fixed;bottom:0;left:0;right:0;height:82px;background:white;border-top:1px solid #ddd;z-index:5}.test-content{padding:18px 16px 140px}</style></head><body><main class="test-content">${portfolio}</main><nav class="test-nav">포트폴리오</nav></body></html>`;
mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [360,390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ko-KR'});
    await page.setContent(doc);
    const state=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('.portfolio-row')],value=rows[0].querySelector('.position-value');
      window.scrollTo(0,document.body.scrollHeight);return {overflow:document.documentElement.scrollWidth>innerWidth,
        amountWrap:value.getClientRects().length!==1||getComputedStyle(value).whiteSpace!=='nowrap',
        lastRow:rows.at(-1).getBoundingClientRect().bottom,nav:document.querySelector('.test-nav').getBoundingClientRect().top}
    });
    await page.screenshot({path:`mobile-artifacts/portfolio-${width}.png`,fullPage:true});
    assert.equal(state.overflow,false,`${width}px horizontal overflow`);
    assert.equal(state.amountWrap,false,`${width}px amount wraps`);
    assert.ok(state.lastRow<=state.nav,`${width}px last row hidden by navigation`);
    await page.close();
  }
}finally{await browser.close()}
console.log('390 / 402 / 430 / 360px mobile layout renders passed (emulated, anonymized fixture)');
