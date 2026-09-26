import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
const start=source.indexOf('  function liveHome(){');
const end=source.indexOf('  function demoPortfolio(){',start);
const scope={ok:true,snapshot_at:'2026-09-26T06:10:03Z',overlay_matches_manual:true,
  broker_account_overlap_verified:true,current_display_total:64_688_793,
  current_primary_value:55_538_715,current_primary_observed_at:'2026-09-26T06:10:03Z',
  current_isa_value:9_150_078,current_isa_source:'user_uploaded_isa_screenshot',
  current_isa_capture_at:'2026-09-26T02:42:00Z',isa_total_only:true,
  isa_unexplained_change:21_088,current_isa_storage_path:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/isa/'+ 'b'.repeat(64)+'.png'};
const live={accounts:[{id:'isa',provider:'kb_securities_manual',provider_account_ref:'isa-manual'}],
  snapshots:[{snapshot_at:scope.snapshot_at,total_assets:64_667_705,securities_value:54_000_000}],
  manualSnapshots:[],performance:null,homeChart:{items:[]},performanceGate:null,
  ledgerEstimate:null,accountScope:scope,settings:{}};
const money=n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원';
const empty=()=>'';
const ctx=vm.createContext({live,liveError:null,period:'1M',isaNotice:'',
  latestManualRows:()=>[],completeSnapshotPeriod:()=>false,ledgerHeadlineReady:()=>false,
  esc:String,money,signedMoney:money,cls:empty,kstStamp:x=>String(x).slice(0,10),periods:empty,
  reconciliationHomeStatus:empty,assetChart:empty,metric:empty,homeBrowseCard:empty,
  riskOverviewCard:empty,decisionHomeCard:empty,reviewHomeCard:empty,cashFlowAuditCard:empty,annualGoalCard:empty,tradeTargetCard:empty,
  dividendCard:empty,priceAlertCard:empty,upcomingAgenda:empty,dataStatusCard:empty});
vm.runInContext(source.slice(start,end),ctx);
const screen=vm.runInContext('liveHome()',ctx);
assert.match(screen,/64,688,793원/);
assert.match(screen,/ISA 잔고 화면으로 총액 갱신/);
assert.match(screen,/data-isa-attachment/);
const doc=`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}\nbody{margin:0}.test-nav{position:fixed;bottom:0;left:0;right:0;height:82px;background:#fff;z-index:5}.test-content{padding:18px 16px 140px}</style></head><body><main class="test-content">${screen}</main><nav class="test-nav">하단 메뉴</nav></body></html>`;
mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ko-KR'});
    await page.setContent(doc);
    await page.locator('details.more-list').evaluate(el=>el.open=true);
    const state=await page.evaluate(()=>{window.scrollTo(0,document.body.scrollHeight);
      const form=document.getElementById('isaTotalForm');
      return {overflow:document.documentElement.scrollWidth>innerWidth,
        formWidth:form.getBoundingClientRect().width,
        buttonBottom:form.querySelector('button').getBoundingClientRect().bottom,
        navTop:document.querySelector('.test-nav').getBoundingClientRect().top}});
    assert.equal(state.overflow,false,`${width}px ISA form horizontal overflow`);
    assert.ok(state.formWidth>0&&state.buttonBottom<=state.navTop,`${width}px form button blocked by navigation`);
    if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'390px enlarged ISA form overflow');}
    await page.screenshot({path:`mobile-artifacts/isa-evidence-${width}.png`,fullPage:true});
    await page.close();
  }
}finally{await browser.close()}
console.log('Build 53 ISA evidence form 390 / 402 / 430px plus enlarged text passed (emulated)');
