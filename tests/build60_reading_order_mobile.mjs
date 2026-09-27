import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

// Synthetic observations exercise the production renderers, without using owner holdings.
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
const live={
  accounts:[{id:'broker',name:'Fixture account'}],
  holdings:[
    {security_id:'a',account_id:'broker',quantity:36,currency:'USD',as_of:'2026-09-27T08:53:00Z'},
    {security_id:'b',account_id:'broker',quantity:4,currency:'USD',as_of:'2026-09-27T08:53:00Z'}],
  securityMap:{a:{name:'First holding',symbol:'ALFA',currency:'USD'},b:{name:'Second holding',symbol:'BETA',currency:'USD'}},
  holdingBasis:[{security_id:'a',account_id:'broker',valuation_krw:15154956,pnl_krw:-600000},
    {security_id:'b',account_id:'broker',valuation_krw:4800000,pnl_krw:230000}],
  snapshots:[{snapshot_at:'2026-09-27T08:53:00Z',snapshot_date:'2026-09-27',total_assets:64000000,
    securities_value:52000000,unrealized_pnl:-370000}],
  performance:{ok:true,return_ready:true,investment_pnl:-90000,return_pct:-0.14,
    period_start:'2026-08-27',period_end:'2026-09-27',realized_pnl:64000,dividends_net:3000},
  performanceGate:{ok:true,state:'estimated',partial:false,reliable_start:'2026-08-27',observed_through:'2026-09-27',investment_pnl:-90000},
  homeChart:{items:[{date:'2026-08-27',total_assets:60000000},{date:'2026-09-15',total_assets:60800000},
    {date:'2026-09-27',total_assets:64000000}]},
  securityPerformance:{items:[{symbol:'ALFA',name:'First holding',confirmed_contribution:-32000,realized_pnl:-32000,dividend_net:0},
    {symbol:'SOLD',name:'Sold holding',confirmed_contribution:64000,realized_pnl:64000,dividend_net:0}]}
};
const money=n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원';
const scope={live,liveError:'',period:'1M',portfolioMarket:'ALL',portfolioAccount:'ALL',portfolioSort:'value',hideZeroHoldings:false,
  realizedPeriod:'1M',realizedAccount:null,mode:'live',window:{},Number,String,Date,Map,Set,Math,
  esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  money,signedMoney:n=>(Number(n)>0?'+':'')+money(n),num:(n,d)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d}),
  pct:n=>(Number(n)>0?'+':'')+Number(n).toFixed(2)+'%',weightPct:n=>Number(n).toFixed(2)+'%',
  cls:n=>Number(n)>=0?'up':'down',kstStamp:x=>String(x||'날짜 미확인'),kstDate:()=> '2026-09-27',
  marketGroup:()=> 'OVERSEAS',completeSnapshotPeriod:()=>true,ledgerHeadlineReady:()=>false,
  latestManualRows:()=>[],reviewHomeCard:()=>'',decisionHomeCard:()=>'',reconciliationHomeStatus:()=>'',
  cashFlowAuditCard:()=>'',annualGoalCard:()=>'',tradeTargetCard:()=>'',dividendCard:()=>'',
  priceAlertCard:()=>'',upcomingAgenda:()=>'',dataStatusCard:()=>'',cashCaseAssessmentCard:()=>'',
  verifiedMovementCard:()=>'',cashAccountingCard:()=>'',analysisCoverageCard:()=>'',ledgerEstimateHtml:()=>'',
  periodAttributionHtml:()=>'',actualPerformanceRange:()=>'',observedPerformanceCard:()=>
    '<section class="card performance-hero"><h3>기간 투자손익 · 2026-08-27 ~ 2026-09-27</h3><div class="asset">-90,000원</div></section>',
  heatmapHtml:()=>'',metric:(label,value)=>'<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>',
  empty:()=>''};
vm.createContext(scope);
function include(start,end){const a=source.indexOf('  function '+start+'('),b=source.indexOf('  function '+end+'(',a+10);assert.ok(a>0&&b>a);vm.runInContext(source.slice(a,b),scope)}
include('periods','chart');include('assetChart','securityChart');include('homeBrowseCard','cashFlowAuditCard');
include('liveHome','demoPortfolio');include('livePortfolio','demoPerformance');include('livePerformance','analysis');
const home=vm.runInContext('liveHome()',scope),holdings=vm.runInContext('livePortfolio()',scope),performance=vm.runInContext('livePerformance()',scope);
assert.ok(home.indexOf('64,000,000원')<home.indexOf('보유 종목'));
assert.ok(home.indexOf('보유 종목')<home.indexOf('자산 추이'));
assert.ok(home.includes('자산 변화')&&home.includes('투자손익과 다릅니다'));
assert.ok(!home.includes('원금 60,000,000원'));
assert.ok(holdings.includes('36주')&&holdings.includes('15,154,956원')&&holdings.includes('-600,000원'));
assert.ok(!holdings.includes('원가단가'));
assert.ok(performance.indexOf('종목별 확인된 실현손익')<performance.indexOf('실현손익·배당·비용과 계산 근거'));
assert.ok(performance.includes('Sold holding'),'sold holdings remain in selected period results');
assert.ok(performance.indexOf('Sold holding')<performance.indexOf('First holding'),'contribution amount sort is consistent');
assert.ok(performance.includes('최근 1개월')&&!performance.includes('이번 달'),'rolling period never claims calendar month');

mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    for(const [name,content] of [['home',home],['portfolio',holdings],['performance',performance]]){
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><main class="shell"><div class="content">'+content+'</div></main><nav class="nav"><button>홈</button><button>포트폴리오</button><button>성과</button></nav>');
      if(name==='portfolio'){
        const rows=await page.locator('.portfolio-row').evaluateAll(elements=>elements.map(x=>({
          value:x.querySelector('.position-value').getBoundingClientRect().right,
          result:x.querySelector('.position-result').getBoundingClientRect().right,
          left:x.querySelector('.position-name').getBoundingClientRect().right,
          right:x.querySelector('.position-value').getBoundingClientRect().left})));
        assert.equal(rows.length,2);
        assert.ok(rows.every(r=>Math.abs(r.value-r.result)<2&&r.left<=r.right+1),`${width}px aligned amounts`);
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width}px no overflow`);
      await page.screenshot({path:`mobile-artifacts/build60-${name}-${width}.png`});
      if(width===390){
        await page.evaluate(()=>document.documentElement.style.zoom='1.25');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} 125% text no overflow`);
      }
    }
    await page.close();
  }
}finally{await browser.close()}
console.log('Home, holdings and period performance show the same synthetic basis at 390/402/430px and 125% zoom');
