import './build165_chart_recovery.mjs';
import './build164_resume.mjs';
import './build162_quick_review.mjs';
import './build159_decision_changes.mjs';
import './build158_review_consistency.mjs';
import './build157_decision_receipt.mjs';
import './build156_read_queue.mjs';
import './build153_load_recovery.mjs';
import './build149_execution_sales.mjs';
import './build148_sale_review.mjs';
import './build147_swing_alerts.mjs';
import './build146_decision_followup.mjs';
import './build145_period_cache.mjs';
import './build144_demand_pnl.mjs';
import './build143_month_review.mjs';
import './build142_fast_refresh.mjs';
import './build141_sync_resilience.mjs';
import './build131_pnl_recovery.mjs';
import './build130_pnl_find.mjs';
import './build128_reference_fx.mjs';
import './build126_pnl_scope.mjs';
import './build122_ipo_history.mjs';
import './build121_domestic_cash.mjs';
import './build120_local_history.mjs';
import './build119_composition.mjs';
import './build114_portfolio_average.mjs';
import './build113_detail_input.mjs';
import './build108_today_journey.mjs';
import {points as swingPoints,values as swingValues} from './build106_swing_peak.mjs';
import './build104_native_prices.mjs';
import './build102_home_today.mjs';
import './build98_holding_prices.mjs';
import assert from 'node:assert/strict';
async function openOptionalTools(page){
 if(!await page.locator('#detailExtras').count())await page.locator('#detailExtras').waitFor({state:'attached'});
 const group=page.locator('#detailExtras');
 if(!await group.evaluate(el=>el.open)){
  if(await page.locator('.detail-price-chart').count())assert.ok(await page.locator('.detail-price-chart').isVisible());
  assert.equal(await page.locator('#detailFreshReview').isVisible(),false,'AI input is optional on initial screen');
  await page.screenshot({path:'mobile-artifacts/simple-detail-'+page.viewportSize().width+'.png'});
  const prices=page.locator('.holding-unit-prices');
  if(await prices.count()){
   const labels=await prices.locator(':scope > .row > span').allTextContents();
   if(labels.includes('환산 평균 매입가'))assert.ok((await prices.locator('strong').allTextContents()).every(x=>/USD|JPY|HKD|확인 중/.test(x)));
   await page.locator('.detail-overview').screenshot({path:'mobile-artifacts/holding-unit-prices-'+page.viewportSize().width+'.png'});
  }
  await group.locator(':scope > summary').click();
 }
}

import vm from 'node:vm';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {chromium} from 'playwright';

// Production HTML, CSS, renderers and handlers; isolated deterministic data only.
// No owner login, network or records are used or changed by this visual test.
const source=readFileSync(process.env.UI_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const baseline=!!process.env.UI_BASELINE;
if(!baseline){if(source.includes('performanceReviewContext'))await import('./build82_performance_review.mjs');await import('./build72_app_update.mjs');await import('./build73_recent_sales.mjs');if(source.includes('stockPeriodPerformance'))await import('./build75_period_ui.mjs');if(source.includes('stockSeparatedHtml'))await import('./build76_separated_pnl.mjs');if(source.includes('stockTotalPartsHtml'))await import('./build77_pnl_composition.mjs');if(source.includes('stockCalculationHtml'))await import('./build78_pnl_reconciliation.mjs');if(source.includes('stockRealizedItems'))await import('./build79_closed_realized.mjs');if(source.includes('stockRealizedEvidenceHtml'))await import('./build80_pnl_clarity.mjs');}
if(!baseline&&source.includes('review-home-item'))await import('./build86_review_home.mjs');
if(!baseline&&source.includes('function allocationData'))await import('./build87_allocation.mjs');
if(!baseline&&source.includes('function requestDetailOpinion'))await import('./build88_recovery.mjs');
if(!baseline&&source.includes('detail-thesis-check'))await import('./build89_ma_thesis.mjs');
const denseUi=source.includes('contribution-toggle');
// Exercise the real refresh lifecycle, which the previous static fixture missed.
if(!process.env.UI_BASELINE){
 const fn=source.slice(source.indexOf('  function runRefreshSync('),source.indexOf('  (function bindPullToRefresh'));
 for(const fail of [false,true]){
  const labels=[],button={set textContent(v){labels.push(v)},setAttribute(){},disabled:false};
  const indicator={classList:{add(){},remove(){}}};
  const ctx={mode:'live',document:{visibilityState:'visible',getElementById:id=>id==='refreshBtn'?button:indicator},session:null,liveRefreshPromise:null,liveError:null,lastLiveLoadAt:0,currentTab:'home',window:{scrollY:0,scrollTo(){}},edgeSync:()=>Promise.resolve(),syncRecentHistory:()=>Promise.resolve(),recentHistoryMonths:()=>['2026-10'],loadLive:()=>fail?Promise.reject(new Error('isolated failure')):Promise.resolve(),live:{},render(){},setTimeout(){}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.refreshLive(true,true).catch(()=>{});
  assert.ok(labels.length>=2);assert.ok(labels.every(x=>x==='↻'),'refresh must stay an icon during load and after success/failure');assert.equal(button.disabled,false);
 }
}

const out=process.env.UI_OUTPUT||'mobile-artifacts/build67';mkdirSync(out,{recursive:true});
const names=[['ARM','에이알엠 홀딩스(ADR)',32,12472000,-534000],['RXRX','리커전 파머슈티컬스',2100,10812500,426000],['MRNA','모더나',40,9627400,672000],['LLY','일라이 릴리',3,5138000,218000],['MU','마이크론 테크놀로지',3,4437100,-67000],['META','메타 플랫폼스',4,4146000,114000],['385560','RISE KIS국고채30년Enhanced',110,7822100,322100]];
const now='2026-09-28T22:10:00Z';
const live={accounts:[{id:'broker',name:'KB 종합위탁',mode:'live',provider:'kb_securities'},{id:'isa',name:'ISA',mode:'live'}],securityMap:{},securities:[],holdings:[],holdingBasis:[],settings:{},manualSnapshots:[],settlementBasis:[],transactions:[],reviewDecisions:[],reviewAnalyses:[],
  snapshots:[{snapshot_at:now,snapshot_date:'2026-09-29',total_assets:63842170,securities_value:54455100,unrealized_pnl:1151100}],
  accountScope:{ok:true,current_display_total:63842170,snapshot_at:now,overlay_matches_manual:true,broker_account_overlap_verified:true,current_primary_value:56020070,current_isa_value:7822100,current_primary_observed_at:now,current_isa_capture_at:'2026-09-26T02:42:00Z',current_isa_source:'kb_account_breakdown_screenshot'},
  performancePeriod:'1M',performance:{ok:true,return_ready:true,investment_pnl:326840,return_pct:.52,period_start:'2026-08-29',period_end:'2026-09-29',realized_pnl:251200,dividends_net:42000},
  performanceGate:{ok:true,state:'estimated',partial:false,reliable_start:'2026-08-29',observed_through:'2026-09-29',investment_pnl:326840,return_estimate_pct:.52,opening_assets:62810330,closing_assets:63842170,external_flow:705000,as_of:now},
  homeChart:{items:[{date:'2026-08-29',total_assets:62810330},{date:'2026-09-04',total_assets:63221000},{date:'2026-09-10',total_assets:61986500},{date:'2026-09-16',total_assets:62178000},{date:'2026-09-22',total_assets:63576900},{date:'2026-09-29',total_assets:63842170}]},
  securityPerformance:{items:[{symbol:'LLY',name:'일라이 릴리',confirmed_contribution:243200,realized_pnl:231200,dividend_net:12000},{symbol:'META',name:'메타 플랫폼스',confirmed_contribution:86000,realized_pnl:76000,dividend_net:10000},{symbol:'ARM',name:'에이알엠 홀딩스(ADR)',confirmed_contribution:-72000,realized_pnl:-72000,dividend_net:0}]}}
for(const [i,[symbol,name,quantity,value,pnl]] of names.entries()){const id='s'+i,currency=i===6?'KRW':'USD',account_id=i===6?'isa':'broker';live.securityMap[id]={id,symbol,name,currency,market:i===6?'KRX':'NAS'};live.securities.push(live.securityMap[id]);live.holdings.push({security_id:id,account_id,quantity,as_of:now,currency,market_value:value,fx_rate_to_base:1});live.holdingBasis.push({security_id:id,account_id,valuation_krw:value,cost_krw:value-pnl,pnl_krw:pnl,average_unit_krw:(value-pnl)/quantity,valued_unit_krw:value/quantity,quantity,as_of:now})}
live.holdings[0].native_prices={source:'KB_SPQM2226_NATIVE',currency:'USD',quantity:live.holdings[0].quantity,average_price:311.2343,market_price:286.58,observed_at:now};
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
live.todayGate={ok:true,state:'estimated',partial:false,observed_through:today,investment_pnl:326840};
live.todayStocks={ok:true,period:'오늘',period_start:today,period_end:today,basis_at:now,complete:false,items:[{security_id:'s0',symbol:'ARM',name:'에이알엠 홀딩스(ADR)',pnl_krw:220000},{security_id:'s1',symbol:'RXRX',name:'리커전 파머슈티컬스',pnl_krw:-80000}]};
live.priceMeta={s0:{latest:{close:285,currency:'USD',price_date:'2026-09-28'}},s1:{latest:{close:5.2,currency:'USD',price_date:'2026-09-28'}}};
const comparison={target_pct:10,price_assumptions:{down_pct:-10,up_pct:10},observation_at:now,denominator:{value:63842170},assets_before_krw:63842170,position_currency:'USD',hold:{quantity:32,value_krw:12472000,weight_pct:19.53,down_impact_krw:-1247200,up_impact_krw:1247200},reduce:{mode:'integer_shares',shares_to_sell:16,quantity_reference:16,value_krw:6236000,weight_pct:9.77,cash_increase_krw:6236000,down_impact_krw:-623600,up_impact_krw:623600,cash_native_estimate:4570}};
const decision={id:'isolated-ui-decision',security_id:'s0',choice:'consider_reduction',reason:'눌림목을 살펴보고 보유 전제가 약해지면 축소 검토',review_condition:'눌림목 모니터링',analysis_id:'isolated-ui-analysis',created_at:now,basis_at:now,thesis_version:1,price_snapshot:{price_date:'2026-09-28',close:285,currency:'USD'},account_snapshot:{observation_at:now},scenario_snapshot:{choice_comparison:comparison}};
const analysis={id:'isolated-ui-analysis',symbol:'ARM',created_at:now,thesis_version:1,response_kind:'model_interpretation_server_metrics',answer:'판단: 저장한 유지 조건이 약해졌다면 축소를 검토하되, 기준을 확인하기 전에는 현재 판단을 유보합니다.\n근거: 가격 참고 고점만으로 사용자의 돌파 조건을 확정할 수 없습니다.\n선택지: 일부 축소는 하락 영향과 상승 참여를 함께 줄입니다.\n다음 확인: 사용자가 정한 보유 조건과 다음 종가를 대조합니다.',comparison_evidence:comparison,price_evidence:{ready:true,price_date:'2026-09-28',latest_close:285,currency:'USD'},external_sources:[]};
const injected=`
  window.__uiPreserveRender=function(){render(true)};
  window.__uiFixture=function(data,record,opinion,comparison){
    live=data;liveError=null;mode='live';period='1M';session={accessToken:'synthetic-ui-session'};
    var stockResponse=data.stockPnl,failStockOnce=false,savedDecision=null;window.__decisionWrites=0;
    if(!crypto.randomUUID){let syntheticId=0;Object.defineProperty(crypto,'randomUUID',{value:()=> '00000000-0000-4000-8000-'+String(++syntheticId).padStart(12,'0')})}
    window.__uiFailStockOnce=function(){failStockOnce=true};
    window.__saleNotes=window.__saleNotes||{};
    rpc=async function(name,p){
      var saleKey=p&&[p.p_security_id,p.p_start,p.p_end].join('|');
      if(name==='get_sale_review')return {ok:true,security_id:p.p_security_id,period_start:p.p_start,period_end:p.p_end,note:window.__saleNotes[saleKey]||null,before:null,during:[],history:[{period_start:'2026-08-01',period_end:'2026-08-31',reason:'이전 기간 복기',lesson:'이전 교훈',next_action:'이전 기준'}]};
      if(name==='save_sale_review'){if(window.__saleFail)throw Error('Synthetic save failure');window.__saleNotes[saleKey]={reason:p.p_reason,lesson:p.p_lesson,next_action:p.p_next_action,revision:p.p_revision+1,updated_at:'2026-10-06T00:00:00Z'};return {ok:true,revision:p.p_revision+1}};

      if(name==='get_live_realized_sales'&&data.closedRealizedFixture)return data.closedRealizedFixture;
      if(name==='get_live_realized_sales')return {ok:true,period:p.p_period,period_start:p.p_period==='1W'?'2026-09-23':'2026-09-01',period_end:'2026-09-29',items:[{symbol:'ARM',name:'에이알엠 홀딩스(ADR)',currency:'USD',realized_local:100,historical_krw_estimate:140000,status:'calculated'},{symbol:'SOXS',name:'SOXS',currency:'USD',realized_local:null,historical_krw_estimate:null,status:'cost_review'}]};
      if(name==='get_live_period_stock_pnl'){if(failStockOnce){failStockOnce=false;throw Error('Simulated timeout')}return {...stockResponse,period:p.p_period,period_start:p.p_period==='1M'?'2026-08-29':'2026-09-01'}};
      if(name==='get_live_security_detail')return {ok:true,security:live.securityMap[p.p_security_id],holding:{quantity:32},technical:{},prices:live.swingPrices[p.p_security_id]||[{date:'2026-09-25',close:297,currency:'USD'},{date:'2026-09-28',close:285,currency:'USD'}]};
      if(name==='get_pending_kb_position_events')return [{symbol:'TEST',type:'sell',order_date:kstDaysAgo(1),settlement_date:kstDate(),quantity:7}];
      if(name==='get_live_security_activity')return {items:[]};
      if(name==='save_investment_thesis'){data.testThesis={...p.p_fields,version:2};return {ok:true,version:2}};
      if(name==='get_investment_thesis')return {ok:true,thesis:data.testThesis||{version:1,rationale:'최근 추세돌파와 상승 흐름을 확인하며 보유',updated_at:record?record.created_at:'2026-09-28T22:10:00Z'}};
      if(name==='save_investment_decision'&&data.decisionSaveFixture){
        window.__decisionWrites++;
        savedDecision={id:'recovered-decision',security_id:p.p_security_id,request_id:p.p_request_id,choice:p.p_choice,reason:p.p_reason,review_condition:p.p_review_condition,analysis_id:p.p_analysis_id,created_at:new Date().toISOString(),thesis_version:1,scenario_snapshot:{}};
        throw Error('Synthetic response lost after commit');
      }
      if(name==='get_investment_decisions')return savedDecision?[savedDecision,...(record?[record]:[])]:record?[record]:[];
      if(name==='get_investment_breakout_rule')return null;
      if(name==='get_live_choice_comparison')return {...comparison,ok:true};
      if(name==='get_live_decision_metrics')return {ok:false};
      return {ok:false,items:[]};
    };
    authFetch=async function(url,options){if(options&&options.method==='POST')throw Error('No model generation or writes allowed in UI capture');return {ok:true,json:async()=>url.includes('investment_decisions?')?(savedDecision?[savedDecision]:[]):[opinion]}};
    loadLive=async()=>{};edgeSync=async(action)=>{if(action==='overseas-day-pnl')return {ok:true,available:false,items:[]};throw Error('No account sync during UI capture')};
    document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.getElementById('refreshBtn').classList.remove('hidden');
    window.__uiAiTest=function(testMode){
      window.__aiMode=testMode;window.__aiIds=[];window.__syncCount=0;
      let idCount=0;window.portfolioAnalysisRequestId=async()=> '00000000-0000-4000-8000-'+String(++idCount).padStart(12,'0');
      const originalRpc=rpc;
      rpc=async function(name,p){if(name==='get_live_decision_metrics')return {ok:true,denominator:{value:63842170},observation_at:'2026-09-28T22:10:00Z'};return originalRpc(name,p)};
      edgeSync=async()=>{window.__syncCount++;return {ok:true}};
      authFetch=async function(url,options){
        if(options&&options.method==='POST'){
          window.__aiIds.push(JSON.parse(options.body).request_id);
          if(window.__aiMode==='failure'||window.__aiMode==='recovery')throw Error('Load failed');
          return {ok:true,json:async()=>({...opinion,comparison_evidence:null,history_saved:true,analysis_id:opinion.id})};
        }
        return {ok:true,json:async()=>window.__aiMode==='recovery'&&url.includes('request_id=eq.')?[{...opinion,comparison_evidence:null}]:[]};
      };
    };
    window.__uiLocalHistory=function(data){live=data;stockPeriod='ALL';stockView='total';currentTab='performance';render()};
    window.__uiRender=function(tab){currentTab=tab;render()};window.__uiDetail=openSecurityDetail;
    render();
  };
`;
let html=source.replace('  restoreLogin();',injected).replace(/<script[^>]+src=[^>]+><\/script>/g,'').replace("navigator.serviceWorker.register('./sw.js'","Promise.reject('fixture only').then('./sw.js'");
// Keep the application's actual AI response renderer as well.
html=html.replace('</body>',`<script>${readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8')}</script></body>`);
writeFileSync(out+'/fixture.html',html);
live.swingAlertState=Object.fromEntries(names.slice(0,4).map((n,i)=>['s'+i,{unread:true}]));
live.swingPrices=Object.fromEntries(names.slice(0,4).map((n,i)=>['s'+i,swingPoints([...swingValues.slice(0,-1),85-i],today)]));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:(await import('@sparticuz/chromium')).default.args}:{} )});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});page.on('dialog',dialog=>{if(page.listenerCount('dialog')===1)dialog.accept()});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.abort());await page.setContent(html,{waitUntil:'domcontentloaded'});
    const fontFile=resolve(process.env.UI_FONT_CSS||'node_modules/@fontsource/noto-sans-kr/400.css');
    if(existsSync(fontFile)){const css=readFileSync(fontFile,'utf8').replace(/url\(([^)]+)\)/g,(_,p)=>`url(data:font/woff2;base64,${readFileSync(resolve(dirname(fontFile),p.replaceAll("'",''))).toString('base64')})`);await page.addStyleTag({content:css+' body{font-family:"Noto Sans KR",sans-serif}'});await page.evaluate(()=>document.fonts.ready)}
    await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    await page.evaluate(()=>window.__uiRender('home'));
    await page.locator('#homeToday [data-security-id="s0"]').click();
    await page.locator('.detail-price-chart').waitFor();
    await page.locator('#detailClose').click();
    assert.match(await page.locator('#homePriceWatch').innerText(),/새 하락 알림 4개/);
    await page.locator('#swingAlertAck').click();
    assert.equal(await page.locator('#swingAlertAck').count(),0);
    assert.equal(await page.locator('#homePriceWatch .price-watch-row:visible').count(),3);
    await page.locator('#homePriceWatch .price-watch-row').first().click();
    await page.locator('.detail-price-chart').waitFor();
    assert.ok(await page.locator('.security-swing-marker').isVisible());
    assert.match(await page.locator('.security-peak-summary').innerText(),/110 USD/);
    await page.locator('.detail-price-chart').screenshot({path:out+'/swing-chart-'+width+'.png'});
    await page.locator('[data-chart-zoom="in"]').click();await page.locator('[data-chart-zoom="in"]').click();
    await page.locator('[data-chart-pan]').focus();await page.keyboard.press('Home');
    assert.equal(await page.locator('.security-swing-marker').isVisible(),false);
    await page.locator('[data-chart-zoom="reset"]').click();
    assert.ok(await page.locator('.security-swing-marker').isVisible());
    await page.locator('#detailClose').click();
    await page.locator('#homePriceWatch').screenshot({path:out+'/swing-home-'+width+'.png'});
    await page.locator('#homePriceWatch summary').first().click();
    assert.equal(await page.locator('#homePriceWatch .price-watch-row:visible').count(),4);
    await page.locator('#homePriceWatch summary').first().click();
    const pendingWatch=page.locator('.price-watch-pending');
    assert.equal(await pendingWatch.locator('button:visible').count(),0);
    await pendingWatch.locator('summary').click();
    assert.ok(await pendingWatch.locator('button:visible').count()>0);
    assert.match(await pendingWatch.innerText(),/가격 자료 없음/);
    await pendingWatch.screenshot({path:out+'/watch-pending-'+width+'.png'});
    await pendingWatch.locator('button').first().click();
    await page.locator('.detail-price-chart').waitFor();
    await page.locator('#detailClose').click();
    assert.ok(await pendingWatch.locator('button').first().isVisible());
    await pendingWatch.locator('summary').click();
    const statusFixture={...live,swingPrices:{...live.swingPrices,s0:swingPoints([...swingValues,120],today)}};
    await page.evaluate(args=>window.__uiFixture(...args),[statusFixture,decision,analysis,comparison]);
    const formingWatch=page.locator('.price-watch-forming');
    assert.match(await formingWatch.locator('summary').innerText(),/새 전고점 형성 중 1종목/);
    assert.equal(await formingWatch.locator('button:visible').count(),0);
    await formingWatch.locator('summary').click();
    assert.match(await formingWatch.innerText(),/이전 전고점 돌파 후 형성 중/);
    await page.locator('#homePriceWatch').screenshot({path:out+'/watch-status-'+width+'.png'});
    await formingWatch.locator('button').click();await page.locator('.detail-price-chart').waitFor();
    await page.locator('#detailClose').click();
    await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    for(const tab of ['home','portfolio','performance']){
      await page.evaluate(tab=>window.__uiRender(tab),tab);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} ${width}px overflow`);
      if(tab==='home'&&!baseline){assert.ok(await page.locator('#homeToday').isVisible());const box=await page.locator('#homeToday').boundingBox();assert.ok(box.y<500,`${width}px today summary is near top`);assert.match(await page.locator('#homeToday').innerText(),/326,840/)}
      if(tab==='portfolio'&&!baseline){assert.equal(await page.locator('#portfolioControls').evaluate(el=>el.open),false,'settings start collapsed');const rows=await page.locator('.portfolio-row').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().bottom));assert.ok(rows[3]<800,`${width}px four portfolio rows with prices visible`)}
      if(tab==='portfolio'){
        const controls=page.locator('#portfolioControls');if(await controls.count()&&!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
        await page.locator('#portfolioPriceView').selectOption('average');
        assert.match(await page.locator('.position-quote').first().innerText(),/평단|평균 매입가/);
        await page.locator('.portfolio-list').screenshot({path:out+'/portfolio-average-'+width+'.png'});
        await page.locator('#portfolioPriceView').selectOption('close');
        assert.match(await page.locator('.position-quote').first().innerText(),/종가/);
        assert.match(await page.locator('.position-quote').first().innerText(),/285 USD/);
        await page.locator('#portfolioSort').selectOption('loss');
        assert.equal(await page.locator('.portfolio-row').first().getAttribute('data-security-id'),'s0');
        await page.locator('#portfolioSort').selectOption('profit');
        assert.equal(await page.locator('.portfolio-row').first().getAttribute('data-security-id'),'s2');
        await page.locator('#portfolioSort').selectOption('value');
      }
      await page.screenshot({path:`${out}/${tab}-${width}.png`});
      if(tab==='performance'&&source.includes('brokerDayCard')){if(source.includes('quiet-realized'))await page.locator('#brokerDayCard>summary').click();await page.locator('#brokerDayResult').getByText('TEST',{exact:true}).waitFor();await page.locator('#brokerDayCard').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/sales-${width}.png`});}
      if(denseUi&&tab==='performance'){
        assert.equal(await page.locator('.performance-breakdown').first().isVisible(),false);
        await page.getByRole('checkbox',{name:'종목별 손익 구성과 근거 표시'}).check();
        assert.ok(await page.locator('.performance-breakdown').first().isVisible());
        await page.getByRole('checkbox',{name:'종목별 손익 구성과 근거 표시'}).uncheck();
      }
      if(denseUi&&tab==='portfolio'){
        await page.locator('#portfolioAccount').selectOption('isa');assert.equal(await page.locator('.portfolio-row').count(),1);
        await page.locator('#portfolioAccount').selectOption('ALL');await page.locator('#search').fill('ARM');
        assert.equal(await page.locator('.portfolio-row:visible').count(),1);
        if(source.includes('holdings-ux-69')){
          await page.locator('#portfolioSort').selectOption('name');assert.equal(await page.locator('#search').inputValue(),'ARM');assert.equal(await page.locator('.portfolio-row:visible').count(),1);
          await page.locator('#search').fill('없는종목XYZ');assert.ok(await page.locator('#portfolioSearchEmpty').isVisible());
          await page.locator('#portfolioSort').selectOption('value');
        }
        await page.locator('#search').fill('ARM');
        const listY=await page.evaluate(()=>window.scrollY);
        await page.locator('.portfolio-row:visible').first().click();
        await page.locator('#detailClose').waitFor({state:'visible'});
        await page.locator('#detailClose').click();
        assert.equal(await page.locator('#search').inputValue(),'ARM','closing stock retains search');
        assert.equal(await page.locator('.portfolio-row:visible').count(),1);
        assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-listY)<3,'closing stock retains list position');
        await page.locator('#search').fill('');
      }

      if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} 125% overflow`);await page.screenshot({path:`${out}/${tab}-390-large.png`});await page.evaluate(()=>document.documentElement.style.zoom='')}
    }
    if(denseUi){
      await page.evaluate(()=>{window.__uiRender('portfolio');document.querySelector('.position-name').textContent='아주 긴 국내 상장 종목 이름을 확인하는 화면';document.querySelector('.position-value').textContent='1,234,567,890원'});
      await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'long names / billion amount / enlarged text');await page.screenshot({path:`${out}/stress-${width}.png`});await page.evaluate(()=>document.documentElement.style.zoom='');
    }
    if(source.includes('function allocationData')){
      const allocationFixture={...live,risk:{ok:true,official_assets_krw:63842170,as_of:now,largest_symbol:'ARM',largest_krw:12472000,top_three_krw:32911900,foreign_currency_krw:46633000,leveraged_etf_krw:0,known_positions_krw:54455100}};
      await page.evaluate(args=>window.__uiFixture(...args),[allocationFixture,decision,analysis,comparison]);await page.evaluate(()=>window.__uiRender('analysis'));
      const allocation=page.locator('.allocation-card');await allocation.waitFor();
      assert.equal(await allocation.locator('button.allocation-row').count(),7);
      assert.match(await allocation.locator('button.allocation-row').first().innerText(),/19.5%/);
      assert.ok(await allocation.locator('.allocation-residual').isVisible());
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'allocation overflow');
      await page.screenshot({path:`${out}/allocation-assets-${width}.png`,fullPage:true});
      await page.locator('[data-allocation-scope="stocks"]').click();
      assert.equal(await page.locator('.allocation-residual').count(),0);assert.match(await allocation.innerText(),/확인된 종목 평가액 합계 = 100%/);
      if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'allocation enlarged text overflow');await page.screenshot({path:`${out}/allocation-large-${width}.png`});await page.evaluate(()=>document.documentElement.style.zoom='')}
      await allocation.locator('[data-decision-detail="s0"]').click();await openOptionalTools(page);await page.locator('#detailDecisionSummary').waitFor();await page.locator('#detailClose').click();assert.ok(await allocation.isVisible());
      await page.locator('[data-allocation-scope="assets"]').click();
      await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    }
    if(source.includes('review-home-item')){
      const reviewData={...live,reviewDecisions:[{...decision,review_condition:'실적을 확인한 뒤 다시 판단'}, {...decision,security_id:'s1',review_condition:'2026-09-29',created_at:'2026-09-27T00:00:00Z'}]};
      await page.evaluate(args=>window.__uiFixture(...args),[reviewData,decision,analysis,comparison]);
      await page.evaluate(()=>window.__uiRender('home'));
      assert.ok(await page.locator('#homeHoldings').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.home-reviews'))&Node.DOCUMENT_POSITION_FOLLOWING)));
      assert.match(await page.locator('.home-reviews>summary').innerText(),/다시 점검할 판단 1개/);
      assert.equal(await page.locator('.home-reviews').evaluate(el=>el.open),true,'due reviews are visible without an extra tap');
      const card=page.locator('.review-home');await card.scrollIntoViewIfNeeded();
      assert.match(await card.innerText(),/다시 점검할 판단 1개/);
      assert.equal(await card.locator('[data-decision-detail]').first().getAttribute('data-decision-detail'),'s1');
      assert.equal(await card.locator('[data-decision-detail="s0"]').isVisible(),false);
      await card.getByText('다른 종목 판단 1개 보기',{exact:true}).click();
      await page.screenshot({path:`${out}/review-home-${width}.png`});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'review list overflow');
      await card.locator('[data-decision-detail="s0"]').click();await page.locator('#detailDecisionReview').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>document.getElementById('detailExtras').open),true,'home review route opens saved-decision section');
      await page.locator('#detailContinueDecision').click();
      assert.equal(await page.locator('#detailReason').inputValue(),decision.reason);
      assert.equal(await page.locator('#detailReview').inputValue(),decision.review_condition);
      await page.locator('#detailReason').fill('작성 중인 새 이유');await page.locator('#detailContinueDecision').click();
      assert.equal(await page.locator('#detailReason').inputValue(),'작성 중인 새 이유','follow-up does not replace edits');
      await page.screenshot({path:`${out}/decision-followup-${width}.png`});
      await page.locator('#detailClose').click();assert.ok(await card.locator('[data-decision-detail="s0"]').isVisible());
      await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    }
    await page.evaluate(()=>window.__uiRender('home'));
    if(await page.locator('#homeTrend').count()){await page.locator('#homeTrend').scrollIntoViewIfNeeded();await page.evaluate(()=>document.getElementById('homeTrend').scrollIntoView({block:'start'}))}
    else{await page.getByRole('heading',{name:/자산 추이/}).scrollIntoViewIfNeeded();await page.getByRole('heading',{name:/자산 추이/}).evaluate(el=>el.closest('section').scrollIntoView({block:'start'}))}
    await page.screenshot({path:`${out}/trend-${width}.png`});
    await page.locator('#assetChartHit').tap();assert.ok(await page.locator('#assetChartTip').isVisible(),'chart observation is touch-readable');
    await page.evaluate(()=>window.__uiDetail('s0'));
    await page.locator('#detailStartAction').waitFor({state:'visible'});
    assert.equal(await page.locator('#detailExtras').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#detailStart').evaluate(el=>el.parentElement.id),'detailBody');
    assert.match(await page.locator('#detailStartHint').innerText(),/지난 결정:/);
    assert.equal(await page.locator('.detail-shortcuts').count(),1);
    await page.locator('[data-detail-jump="holding"]').click();
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('detail-overview')),true);
    await page.locator('[data-detail-jump="reason"]').click();
    assert.equal(await page.locator('#detailExtras').evaluate(el=>el.open),true);
    assert.equal(await page.evaluate(()=>document.activeElement.contains(document.getElementById('detailThesisSummary'))),true);
    await page.locator('[data-detail-jump="decision"]').click();
    assert.equal(await page.locator('#detailExtras').evaluate(el=>el.open),true);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'detailDecisionReview');
    await openOptionalTools(page);await page.locator('#detailDecisionSummary').waitFor();await page.getByText('눌림목을 살펴보고').first().waitFor();
    assert.equal(await page.locator('#detailDecisionForm').isVisible(),false,'saved judgment precedes form');
    await page.screenshot({path:`${out}/detail-${width}.png`});
    if(source.includes('detail-price-chart')){
      assert.equal(await page.locator('#detailBody > :first-child').getAttribute('class'),'card detail-price-chart');
      assert.equal(await page.locator('.detail-price-chart').evaluate(el=>!!el.closest('details:not([open])')),false);
      assert.equal(await page.locator('.detail-price-chart .security-chart-hit').count(),1);
    }
    if(source.includes("startPanel.id='detailStart'")){
      if(width===390){await page.locator('.detail-usage').evaluate(x=>x.open=true);await page.screenshot({path:`${out}/detail-guide-${width}.png`});await page.locator('.detail-usage').evaluate(x=>x.open=false)}
      await page.locator('#detailStartAction').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'detailDecisionReview');
    }
    await page.locator('#detailDecisionSummary').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/judgment-${width}.png`});
    if(source.includes('brokerDayCard')){await page.locator('#detailDecisionReview').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/review-${width}.png`});}
    if(source.includes('detailSetupRule')){
      await page.locator('#detailSetupRule').click();
      assert.ok(await page.locator('#detailDecisionForm').isVisible());
      assert.equal(await page.evaluate(()=>document.activeElement.id),'detailRuleType');
      const original=await page.locator('#detailReview').inputValue();
      const saved=await page.locator('#detailDecisionSummary').innerText();
      await page.locator('#detailRuleType').selectOption('ma');
      assert.equal(await page.locator('#detailReview').inputValue(),original,'select alone does not overwrite draft');
      await page.locator('#detailApplyRule').click();
      assert.equal(await page.locator('#detailReview').inputValue(),'20·60·120개 종가 단순평균 정배열 이탈');
      await page.locator('#detailRuleType').selectOption('price');
      await page.locator('#detailRuleAmount').fill('-1');await page.locator('#detailApplyRule').click();
      assert.match(await page.locator('#detailRuleFeedback').innerText(),/0보다 큰/);
      await page.locator('#detailRuleAmount').fill('250.5');await page.locator('#detailRuleCurrency').selectOption('USD');await page.locator('#detailRuleDirection').selectOption('이하');await page.locator('#detailApplyRule').click();
      assert.equal(await page.locator('#detailReview').inputValue(),'종가 250.5 달러 이하');
      await page.locator('#detailRuleType').selectOption('date');await page.locator('#detailRuleDay').fill('2099-12-01');await page.locator('#detailApplyRule').click();
      assert.equal(await page.locator('#detailReview').inputValue(),'2099-12-01');
      assert.equal(await page.locator('#detailDecisionSummary').innerText(),saved,'applying a draft must not change saved judgment');
      await page.locator('#detailRuleType').selectOption('ma');
      await page.locator('#detailRuleBuilder').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/condition-builder-${width}.png`});
      await page.locator('#detailReview').fill(original);
    }
    await page.locator('#detailDecisionAction').click();assert.ok(await page.locator('#detailDecisionForm').isVisible());
    if(source.includes('detailMaRule')){
      const previous=await page.locator('#detailReview').inputValue();
      await page.getByText('확인 가능한 조건 예시',{exact:true}).click();
      await page.locator('#detailMaRule').click();
      assert.equal(await page.locator('#detailReview').inputValue(),'20·60·120개 종가 단순평균 정배열 이탈');
      await page.locator('#detailReview').fill(previous);
    }
    await page.setViewportSize({width,height:500});await page.locator('#detailReason').fill('검증 중 작성한 이유');await page.locator('#detailDecisionForm button[type=submit]').scrollIntoViewIfNeeded();const save=await page.locator('#detailDecisionForm button[type=submit]').boundingBox();assert.ok(save.y>=0&&save.y+save.height<=500,'save reachable with simulated keyboard');
    if(source.includes("startPanel.id='detailStart'")&&width===390){
      await page.setViewportSize({width,height:844});
      await page.evaluate(args=>window.__uiFixture(...args),[live,null,analysis,comparison]);await page.evaluate(()=>window.__uiDetail('s0'));await openOptionalTools(page);
      await page.getByRole('button',{name:'AI 의견부터 확인하기'}).waitFor();await page.screenshot({path:`${out}/detail-first-review-${width}.png`});
      await page.locator('#detailStartAction').click();assert.ok(await page.locator('#detailFreshReview').isVisible());
      if(source.includes('detailDirectDecision')){
        await page.locator('#detailDirectDecision').click();assert.ok(await page.locator('#detailDecisionForm').isVisible());
        await page.locator('#detailChoice').selectOption('hold');assert.match(await page.locator('#detailChoiceGuide').innerText(),/목표 비중 없이/);
        if(source.includes('function updateDecisionGuide')){
          assert.match(await page.locator('#detailReview').getAttribute('placeholder'),/실적/);
          assert.match(await page.locator('#detailDecisionForm button[type=submit]').innerText(),/현재 유지/);
        }
        await page.locator('#detailReason').fill('비교 후에도 보존할 작성 이유');
        await page.locator('#detailChoice').selectOption('consider_reduction');await page.getByRole('button',{name:'매도 수량 비교하기',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.activeElement.id),'detailWeightTarget');
        assert.equal(await page.locator('#detailReason').inputValue(),'비교 후에도 보존할 작성 이유');
        if(source.includes('function updateDecisionGuide'))assert.match(await page.locator('#detailDecisionForm button[type=submit]').innerText(),/일부 축소 검토/);
        await page.locator('#detailDecisionAction').click();await page.screenshot({path:`${out}/decision-guide-${width}.png`});
      }
      const noReason={...live,testThesis:{version:0,rationale:''}};
      await page.evaluate(args=>window.__uiFixture(...args),[noReason,null,analysis,comparison]);await page.evaluate(()=>window.__uiDetail('s0'));await openOptionalTools(page);
      await page.getByRole('button',{name:'먼저 보유 이유 적기'}).waitFor();await page.locator('#detailStartAction').click();assert.ok(await page.locator('[data-thesis-field="rationale"]').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-thesis-field')),'rationale');
      if(source.includes('function openReasonEditor')){
        assert.equal(await page.locator('#detailStart #thesisGroup').count(),1);
        await page.locator('#thesisForm button[type=submit]').click();assert.match(await page.locator('#thesisStatus').innerText(),/한 줄/);
        if(source.includes('thesisMaApply')){
          await page.locator('[data-thesis-field="rationale"]').fill('이평선 정배열로 보유');
          await page.locator('#thesisMaSetup > summary').click();
          await page.locator('#thesisMaPeriods').selectOption('5·20·60');
          await page.locator('#thesisMaApply').click();
          assert.equal(await page.locator('[data-thesis-field="rationale"]').inputValue(),'이평선 정배열로 보유\n이평선 기준: 5·20·60일 단순이동평균 정배열');
          await page.locator('#thesisMaApply').click();
          assert.match(await page.locator('#thesisMaFeedback').innerText(),/이미 숫자/);
          await page.screenshot({path:`${out}/thesis-periods-${width}.png`});
        }
        await page.locator('[data-thesis-field="rationale"]').fill('실적 개선을 기대하며 보유');
        await page.locator('#thesisForm button[type=submit]').click();
        await page.getByRole('button',{name:'AI로 보유 이유 점검',exact:true}).waitFor();
        assert.match(await page.locator('#detailThesisSummary').innerText(),/실적 개선/);
        assert.equal(await page.locator('#thesisGroup').getAttribute('open'),null);
        await page.waitForFunction(()=>{const r=document.getElementById('detailStartAction').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight});
        await page.screenshot({path:`${out}/reason-saved-${width}.png`});
      }

    }
    if(source.includes('stockPeriodPerformance')){
      await page.locator('#detailClose').click();await page.setViewportSize({width,height:844});
      const stockData={...live,stockPnl:{ok:true,period:'THIS_MONTH',period_start:'2026-09-01',period_end:'2026-09-29',basis_at:now,complete:true,pnl_krw:-1500000,calculation:{opening_krw:20000000,ending_krw:23000000,net_trade_cash_krw:-4510000,dividend_krw:10000,difference_krw:0},included_count:2,krw_included_count:2,candidate_count:2,items:[{symbol:'ARM',name:'에이알엠 홀딩스(ADR)',currency:'USD',pnl_local:-1500,pnl_krw:-2000000,start_quantity:0,end_quantity:32,start_value_local:0,end_value_local:10000,trade_cash_local:-11500,dividend_local:0,pending_count:2},{symbol:'MRNA',name:'모더나',currency:'USD',pnl_local:400,pnl_krw:500000,start_quantity:10,end_quantity:20,start_value_local:1000,end_value_local:2500,trade_cash_local:-1100,dividend_local:0,pending_count:1}]}};
      await page.evaluate(args=>window.__uiFixture(...args),[stockData,decision,analysis,comparison]);await page.evaluate(()=>window.__uiRender('performance'));
      await page.getByRole('heading',{name:'어디서 벌고 잃었나'}).waitFor();
      assert.match(await page.locator('.performance-hero').first().innerText(),/-1,500,000/);
      assert.equal(await page.locator('.performance-position').count(),2);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'stock period overflow');
      if(source.includes('stockTotalPartsHtml')){assert.equal(await page.locator('.pnl-composition').evaluate(el=>el.open),false);await page.locator('.pnl-composition>summary').click();await page.locator('.stock-total-parts').getByText('미분리 금액',{exact:true}).waitFor();assert.match(await page.locator('.stock-total-parts').innerText(),/-1,650,000/)}
      if(source.includes('stockCalculationHtml')){if(source.includes('quiet-realized'))await page.getByText('구성과 계산 기준',{exact:true}).click();await page.locator('.stock-calculation summary').click();await page.locator('.stock-calculation').scrollIntoViewIfNeeded();assert.match(await page.locator('.stock-calculation').innerText(),/20,000,000/);await page.screenshot({path:`${out}/calculation-${width}.png`});await page.locator('.stock-calculation summary').click();if(source.includes('quiet-realized'))await page.getByText('구성과 계산 기준',{exact:true}).click();await page.evaluate(()=>scrollTo(0,0));}
      await page.locator('.pnl-composition').scrollIntoViewIfNeeded();
      const resumeY=await page.evaluate(()=>window.scrollY);
      await page.evaluate(()=>window.__uiPreserveRender());
      assert.equal(await page.locator('.pnl-composition').evaluate(el=>el.open),true,'background render keeps expanded composition');
      assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-resumeY)<3,'background render keeps current scroll');
      await page.locator('.pnl-composition>summary').click();
      assert.match(await page.locator('.pnl-leaders').innerText(),/원화 계산 종목 중/);
      await page.locator('[data-pnl-leader="ARM"]').click();await page.locator('.performance-review-context').waitFor();await page.locator('#detailClose').click();
      await page.screenshot({path:`${out}/period-stock-${width}.png`});
      await page.locator('.contribution-toggle input').check();assert.match(await page.locator('.performance-breakdown').first().innerText(),/거래통화 손익/);
      if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/period-stock-large-${width}.png`});await page.evaluate(()=>document.documentElement.style.zoom='')}
      if(width===390)await page.evaluate(()=>window.__uiFailStockOnce());
      await page.locator('[data-stock-period="1M"]').click();
      if(width===390){await page.locator('#stockPnlRetry').waitFor();assert.equal(await page.locator('.performance-hero').count(),0,'failed period must not show old numbers');await page.locator('#stockPnlRetry').click()}
      assert.match(await page.locator('.performance-hero').first().innerText(),/2026-08-29/);
      await page.locator('[data-stock-period="THIS_MONTH"]').click();assert.match(await page.locator('.performance-hero').first().innerText(),/2026-09-01/);
      const foreignReview={...stockData,stockPnl:{...stockData.stockPnl,items:stockData.stockPnl.items.map(x=>x.symbol==='ARM'?{...x,pnl_krw:null,pnl_local:-1500,local_cash_only:true,separate_cash_krw:-1234,provisional_amount:true}:x)}};
      await page.evaluate(args=>window.__uiFixture(...args),[foreignReview,decision,analysis,comparison]);await page.evaluate(()=>window.__uiRender('performance'));
      await page.locator('[data-performance-detail="ARM"]').click();
      await page.locator('.performance-review-context').waitFor();
      assert.match(await page.locator('.performance-review-context').innerText(),/-1,500(?:\.00)? USD/);
      assert.match(await page.locator('.performance-review-context').innerText(),/별도 원화 세금 -1,234원/);
      assert.match(await page.locator('.performance-review-context').innerText(),/이번 달 기간손익/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/foreign-review-${width}.png`});
      await page.locator('#detailClose').click();
      await page.evaluate(args=>window.__uiFixture(...args),[stockData,decision,analysis,comparison]);await page.evaluate(()=>window.__uiRender('performance'));
      if(source.includes('stockSeparatedHtml')){
        await page.locator('[data-stock-view="unrealized"]').click();
        assert.match(await page.locator('.performance-hero').innerText(),/현재 보유분/);
        assert.equal(await page.locator('[data-stock-period]').count(),0);
        assert.equal(await page.locator('#brokerDayCard').count(),0);
        assert.equal(await page.locator('.performance-position').count(),6,'ISA excluded');
        await page.screenshot({path:`${out}/unrealized-${width}.png`});
        await page.locator('[data-stock-view="realized"]').click();
        await page.getByRole('heading',{name:'종목별 실현손익'}).waitFor();
        assert.match(await page.locator('.performance-hero').innerText(),/140,000/);
        assert.match(await page.locator('.performance-hero').innerText(),/일부 계산/);
        assert.equal(await page.locator('.performance-position').count(),2);
        if(source.includes('stockRealizedEvidenceHtml')){
          if(source.includes('quiet-realized')){
            assert.equal(await page.locator('.stock-component-detail').first().isVisible(),false);
            assert.equal(await page.locator('#brokerDayDate').isVisible(),false);
            await page.screenshot({path:`${out}/quiet-realized-${width}.png`});
            var reviewScroll=await page.evaluate(()=>scrollY);await page.locator('.quiet-realized [data-performance-detail="ARM"]').click();
            await page.locator('#detailClose').waitFor();
            assert.match(await page.locator('#detailBody').innerText(),/ARM|에이알엠/);
            if(source.includes('performanceReviewContext')){await page.locator('.performance-review-context').waitFor();assert.match(await page.locator('.performance-review-context').innerText(),/이번 달 실현손익/);assert.match(await page.locator('.performance-review-context').innerText(),/140,000/);await page.screenshot({path:`${out}/performance-review-${width}.png`});}
            await page.locator('#detailClose').click();if(source.includes('performanceReviewContext'))assert.ok(Math.abs((await page.evaluate(()=>scrollY))-reviewScroll)<3);
            await page.getByRole('checkbox',{name:'매도 건수와 계산 근거 표시'}).check();
            await page.locator('#brokerDayCard>summary').click();
          }
          await page.locator('.sale-row-details').last().locator(':scope > summary').click();
          await page.locator('.stock-row-evidence').last().locator('summary').click();
          assert.match(await page.locator('.stock-row-evidence').last().innerText(),/매수원가 확인 필요/);
          const boxes=await page.locator('#brokerDayCard .tool-row').evaluate(el=>{const a=el.querySelector('input').getBoundingClientRect(),b=el.querySelector('button').getBoundingClientRect();return {inputRight:a.right,buttonLeft:b.left,inputBottom:a.bottom,buttonTop:b.top}});
          assert.ok(boxes.inputRight<=boxes.buttonLeft||boxes.inputBottom<=boxes.buttonTop,'date and button must not overlap');
        }
        await page.screenshot({path:`${out}/realized-${width}.png`});
        if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/realized-large-${width}.png`});await page.evaluate(()=>document.documentElement.style.zoom='')}
        await page.locator('[data-stock-period="1W"]').click();await page.getByRole('heading',{name:'종목별 실현손익'}).waitFor();assert.match(await page.locator('.performance-hero').innerText(),/2026-09-23/);
        await page.locator('[data-stock-period="THIS_MONTH"]').click();await page.locator('[data-stock-view="total"]').click();
      }
      if(source.includes('stockRealizedItems')){
        const closedData={...stockData,securityMap:{...stockData.securityMap,sold:{id:'sold',symbol:'TEST',name:'기간 내 전량 매도 종목',currency:'USD'}},stockRealizedPeriod:null,stockRealized:null,closedRealizedFixture:{ok:true,period:'THIS_MONTH',period_start:'2026-09-01',period_end:'2026-09-29',items:[{symbol:'TEST',currency:'USD',realized_local:null},{symbol:'TEST',currency:'USD',realized_local:10,historical_krw_estimate:14000}],closed_cycles:[{symbol:'TEST',name:'기간 내 전량 매도 종목',currency:'USD',aliases:['TEST'],closed_realized:{method:'flat_to_flat_net_cash',sale_count:2,realized_local:-100,realized_krw:-140000,provisional_date_count:0}}]}};
        await page.evaluate(args=>window.__uiFixture(...args),[closedData,decision,analysis,comparison]);await page.locator('[data-stock-view="realized"]').click();await page.getByRole('checkbox',{name:'매도 건수와 계산 근거 표시'}).check();await page.getByText(/매도 2건 · 기간 합계 계산/).waitFor();assert.match(await page.locator('.performance-hero').innerText(),/-140,000/);assert.equal(await page.locator('.performance-position').count(),1);await page.screenshot({path:`${out}/closed-realized-${width}.png`});
        await page.locator('.sale-row-details>summary').click();await page.locator('[data-sale-review="TEST"]').click();await page.locator('#saleReviewForm').waitFor();
        assert.match(await page.locator('#detailBody').innerText(),/-140,000/);
        await page.locator('#saleReviewReason').fill('계획한 비중 축소');await page.locator('#saleReviewLesson').fill('분할 매도 기준을 미리 정하기');await page.locator('#saleReviewNext').fill('매도 전 조건 확인');
        await page.evaluate(()=>window.__saleFail=true);await page.locator('#saleReviewForm button').click();await page.getByText(/저장 확인 실패/).waitFor();assert.equal(await page.locator('#saleReviewReason').inputValue(),'계획한 비중 축소');
        await page.evaluate(()=>window.__saleFail=false);await page.locator('#saleReviewForm button').click();await page.getByText(/복기 저장 완료/).waitFor();
        await page.screenshot({path:`${out}/sale-review-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.locator('#detailClose').click();await page.locator('[data-sale-review="TEST"]').click();await page.locator('#saleReviewForm').waitFor();assert.equal(await page.locator('#saleReviewLesson').inputValue(),'분할 매도 기준을 미리 정하기');await page.getByText('지난 복기 1개 보기',{exact:true}).click();assert.ok(await page.getByText('이전 기간 복기',{exact:true}).isVisible());await page.locator('#detailClose').click();
        await page.locator('[data-stock-view="total"]').click();
      }
      const localHistory={...stockData,stockRealizedPeriod:'ALL',stockRealizedFailed:true,stockPnl:{...stockData.stockPnl,period:'ALL',complete:false,local_only_count:1,candidate_count:3,items:[...stockData.stockPnl.items,{symbol:'LOCAL',name:'외화 전체 손익 검증',currency:'USD',pnl_local:12345.67,pnl_krw:null,local_cash_only:true,reason:'거래일 확인 필요',start_quantity:0,end_quantity:0,start_value_local:0,end_value_local:0,trade_cash_local:12340.67,dividend_local:5}]}};
      await page.evaluate(data=>window.__uiLocalHistory(data),localHistory);
      const localRow=page.locator('.performance-position').filter({hasText:'외화 전체 손익 검증'});
      assert.match(await localRow.innerText(),/12,345.67 USD/);
      assert.match(await localRow.innerText(),/원화 환산 대기/);
      assert.match(await page.locator('.performance-hero').innerText(),/-1,500,000/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/local-history-${width}.png`});
      for(const basis of ['held','split_closed','ledger_closed']){
        const basisData={...localHistory,stockPnl:{...localHistory.stockPnl,items:localHistory.stockPnl.items.map(x=>x.symbol==='LOCAL'?{...x,local_history_basis:basis,end_quantity:basis==='held'?2:0}:x)}};
        await page.evaluate(data=>window.__uiLocalHistory(data),basisData);
        await page.getByRole('checkbox',{name:'종목별 손익 구성과 근거 표시'}).check();
        assert.match(await page.locator('.performance-position').filter({hasText:'외화 전체 손익 검증'}).innerText(),basis==='held'?/현재 평가액 \+ 전체 원장/:basis==='ledger_closed'?/전체 원장 날짜·수량 대조/:/분할 입출고 대조/);
        assert.match(await page.locator('.performance-hero').innerText(),/-1,500,000/);
      }

      for(const basis of ['pending','corporate_group']){
        const next={...localHistory,stockPnl:{...localHistory.stockPnl,all_items_displayed:true,source_candidate_count:4,provisional_count:basis==='pending'?1:0,items:localHistory.stockPnl.items.map(x=>x.symbol==='LOCAL'?{...x,local_history_basis:basis,provisional_amount:basis==='pending',aliases:['OLDTEST','LOCAL'],corporate_cash_local:2,separate_cash_krw:basis==='corporate_group'?-1234:0}:x)}};
        await page.evaluate(data=>window.__uiLocalHistory(data),next);
        const row=page.locator('.performance-position').filter({hasText:'외화 전체 손익 검증'});
        assert.match(await row.innerText(),basis==='pending'?/결제 전 잠정/:/별도 세금 -1,234원/);
        await page.getByText('전체 4개 종목 기록 반영',{exact:false}).waitFor();
        await page.getByRole('checkbox',{name:'종목별 손익 구성과 근거 표시'}).check();
        assert.match(await row.innerText(),basis==='pending'?/결제 후 금액이 달라질 수 있는/:/OLDTEST · LOCAL/);
        assert.match(await page.locator('.performance-hero').innerText(),basis==='corporate_group'?/-1,501,234/:/-1,500,000/);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:`${out}/history-${basis}-${width}.png`});
      }
      const scopeFixture={...localHistory,stockPnl:{...localHistory.stockPnl,comparison_fx:{USD:1400},items:[{symbol:'LOCAL',name:'외화 큰 손실',currency:'USD',pnl_local:-2000,pnl_krw:null,local_cash_only:true,local_history_basis:'corporate_group',reason:'거래일 확인 필요',separate_cash_krw:-100000,corporate_realized_local:-5000,corporate_distribution_local:3000,start_quantity:0,end_quantity:0,start_value_local:0,end_value_local:0,trade_cash_local:-5000,dividend_local:3000,aliases:['OLDLOCAL','LOCAL']},{symbol:'KRLOSS',name:'원화 작은 손실',currency:'KRW',pnl_local:-500000,pnl_krw:-500000},{symbol:'KRGAIN',name:'원화 이익',currency:'KRW',pnl_local:1000000,pnl_krw:1000000}],pnl_krw:500000,candidate_count:3,krw_included_count:2,local_only_count:1}};
      await page.evaluate(data=>window.__uiLocalHistory(data),scopeFixture);
      await page.locator('#stockPnlSort').selectOption('loss');
      assert.match(await page.locator('.performance-position').first().innerText(),/외화 큰 손실/);
      assert.match(await page.locator('.performance-hero').innerText(),/전체 원화 합계는 아직 미확정/);
      assert.match(await page.locator('.performance-hero').innerText(),/400,000원/);
      assert.match(await page.locator('.performance-hero').innerText(),/-2,000(?:\.00)? USD/);
      assert.match(await page.locator('.corporate-summary').innerText(),/매매 -5,000(?:\.00)? USD/);
      assert.equal(await page.locator('.scoped-pnl-parts').evaluate(el=>el.open),false);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/mixed-pnl-scope-${width}.png`});
      assert.equal(await page.locator('.reference-pnl-unavailable').count(),1);
      const referenceFixture={...scopeFixture,stockPnl:{...scopeFixture.stockPnl,period:'ALL',items:scopeFixture.stockPnl.items.map(x=>x.symbol==='LOCAL'?{...x,reference_pnl_krw:-3000000,reference_fx_basis:'event_date_with_ledger_fallback',reference_ledger_date_count:4}:x)}};
      await page.evaluate(data=>window.__uiLocalHistory(data),referenceFixture);
      assert.equal(await page.locator('.reference-pnl').evaluate(el=>el.open),false);
      await page.locator('.reference-pnl summary').click();
      assert.match(await page.locator('.reference-pnl').innerText(),/-2,600,000원/);
      assert.match(await page.locator('.reference-pnl').innerText(),/체결일 미확인 4건/);
      assert.match(await page.locator('.performance-hero').innerText(),/400,000원/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/reference-fx-${width}.png`});
      const heroBeforeFind=await page.locator('.performance-hero').innerText();
      await page.locator('#stockPnlSearch').fill('oldlocal');
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),1);
      assert.equal(await page.locator('#stockPnlSearch').evaluate(el=>document.activeElement===el),true);
      assert.equal(await page.locator('.performance-hero').innerText(),heroBeforeFind);
      await page.locator('[data-pnl-scope="kr"]').click();
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),0);
      assert.equal(await page.locator('#stockPnlEmpty').isVisible(),true);
      await page.locator('#stockPnlReset').click();
      await page.locator('[data-pnl-scope="foreign"]').click();
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),1);
      await page.locator('#stockPnlSort').selectOption('profit');
      assert.equal(await page.locator('[data-pnl-scope="foreign"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),1);
      await page.locator('[data-pnl-scope="held"]').click();
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),0);
      await page.locator('#stockPnlReset').click();
      assert.equal(await page.locator('[data-stock-pnl-row]:visible').count(),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${out}/pnl-find-${width}.png`});


      await page.locator('[data-stock-period="THIS_MONTH"]').click();
      await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    }
    if(!baseline&&source.includes('function requestDetailOpinion')){
      const maOpinion=source.includes('detail-thesis-check')?{...analysis,price_evidence:{...analysis.price_evidence,moving_averages:{ready:true,periods:[20,60,120],basis:'reference_periods',order:'bullish'}}}:analysis;
      const maLive=source.includes('detail-thesis-check')?{...live,testThesis:{version:1,rationale:'이평선 정배열'}}:live;
      await page.evaluate(args=>{window.__uiFixture(...args);window.__uiAiTest('failure');window.__uiDetail('s0')},[maLive,decision,maOpinion,comparison]);await openOptionalTools(page);
      await page.locator('#detailFreshReview').waitFor();
      await page.evaluate(()=>{document.getElementById('detailReason').value='보유 이유 유지';document.getElementById('detailReview').value='다음 종가 확인';document.getElementById('detailWeightTarget').value=''});
      await page.locator('#detailFreshReview').click();
      await page.waitForFunction(()=>document.getElementById('thesisAnalysis').textContent.includes('AI 응답을 받지 못했습니다'));
      assert.equal(await page.locator('#detailFreshReview').isEnabled(),true);
      assert.equal(await page.locator('#detailFreshStatus').innerText(),'');
      assert.equal(await page.locator('#detailReason').inputValue(),'보유 이유 유지');
      assert.equal(await page.locator('#detailReview').inputValue(),'다음 종가 확인');
      await page.screenshot({path:`${out}/ai-retry-${width}.png`});
      await page.evaluate(()=>window.__aiMode='recovery');
      await page.locator('#detailFreshReview').click();
      await page.waitForFunction(()=>document.getElementById('thesisAnalysis').textContent.includes('이전 저장 답변'));
      assert.equal(await page.locator('#detailFreshReview').isEnabled(),true);
      const requestState=await page.evaluate(()=>({ids:window.__aiIds,syncs:window.__syncCount}));
      assert.equal(requestState.ids.length,2);assert.equal(requestState.ids[0],requestState.ids[1]);assert.equal(requestState.syncs,2,'uncertain response retry preserves original snapshot');
      assert.doesNotMatch(await page.locator('#detailWeightResult').innerText(),/갱신하는 중/);
      if(source.includes('detail-thesis-check')){assert.match(await page.locator('.detail-thesis-check').innerText(),/정배열 방향.*내 기간 미지정/);assert.equal(await page.locator('#detailBreakoutGroup').isVisible(),false)}
      await page.screenshot({path:`${out}/ai-recovered-${width}.png`});
      await page.locator('#detailClose').click();
    }
    const browsePrices=swingPoints(Array.from({length:160},(_,i)=>100+i),today);
    const todayJourney={...live,swingPrices:{...live.swingPrices,s0:browsePrices,s1:browsePrices,s3:browsePrices.slice(-2)},todayGate:null,todayStocks:{...live.todayStocks,pnl_krw:140000,candidate_count:4,krw_included_count:3,items:[
      {security_id:'s0',symbol:'ARM',name:'에이알엠 홀딩스(ADR)',currency:'USD',end_quantity:32,pnl_krw:220000},
      {security_id:'s1',symbol:'RXRX',name:'리커전 파머슈티컬스',currency:'USD',end_quantity:2100,pnl_krw:-80000},
      {security_id:'s3',symbol:'LLY',name:'일라이 릴리',currency:'USD',end_quantity:3,pnl_krw:0},
      {security_id:'s2',symbol:'MRNA',name:'모더나',currency:'USD',end_quantity:40,pnl_krw:null,reason:'가격 확인 필요'}]}};
    await page.evaluate(args=>{window.__uiFixture(...args);window.__uiRender('home')},[todayJourney,decision,analysis,comparison]);
    assert.match(await page.locator('#homeToday').innerText(),/집계 대기/);
    await page.locator('[data-home-today-performance]').click();
    assert.equal(await page.locator('[data-stock-period="오늘"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-stock-view="total"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.performance-position').count(),4);
    assert.match(await page.locator('.performance-hero').first().innerText(),/140,000/);
    await page.locator('#stockPnlSort').selectOption('loss');
    assert.match(await page.locator('.performance-position').first().innerText(),/리커전/);
    await page.locator('#stockPnlSort').selectOption('profit');
    assert.match(await page.locator('.performance-position').first().innerText(),/에이알엠/);
    assert.match(await page.locator('.performance-position').last().innerText(),/계산 대기/);
    await page.locator('.contribution-list').screenshot({path:out+'/today-all-'+width+'.png'});
    await page.locator('[data-performance-detail="ARM"]').click();await page.locator('.detail-price-chart').waitFor();
    assert.equal(await page.locator('[data-detail-step="-1"]').isDisabled(),true);
    assert.match(await page.locator('.detail-browse').innerText(),/1 \/ 4/);
    await page.locator('[data-chart-period="3"]').click();
    await page.locator('[data-ma-period="5"]').check();
    await page.locator('[data-ma-period="20"]').uncheck();
    await page.locator('[data-ma-period="120"]').check();
    await page.locator('[data-detail-step="1"]').click();
    await page.locator('.detail-head b').getByText('일라이 릴리',{exact:true}).waitFor();
    await page.locator('.performance-review-context').getByText('0원',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-chart-period="3"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-ma-period="120"]').isDisabled(),true);
    assert.equal(await page.locator('[data-ma-period="120"]').isChecked(),false);
    await page.locator('[data-detail-step="1"]').click();
    await page.locator('.detail-head b').getByText('리커전 파머슈티컬스',{exact:true}).waitFor();
    await page.locator('.performance-review-context').getByText('-80,000원',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-chart-period="3"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-ma-period="5"]').isChecked(),true);
    assert.equal(await page.locator('[data-ma-period="20"]').isChecked(),false);
    assert.equal(await page.locator('[data-ma-period="120"]').isChecked(),true);
    assert.match(await page.locator('[data-price-date]').innerText(),new RegExp(today));
    await page.locator('.detail-price-chart').screenshot({path:out+'/chart-continuity-'+width+'.png'});
    await page.locator('[data-detail-step="1"]').click();
    await page.locator('.detail-head b').getByText('모더나',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-detail-step="1"]').isDisabled(),true);
    await page.locator('[data-detail-step="-1"]').click();await page.locator('.detail-price-chart').waitFor();
    await page.locator('.detail-browse').screenshot({path:out+'/detail-browse-'+width+'.png'});
    await openOptionalTools(page);
    await page.locator('#detailDecisionAction').click();
    await page.locator('#detailReason').fill('입력 보존 확인');
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('#detailClose').click();
    assert.equal(await page.locator('#detailReason').inputValue(),'입력 보존 확인');
    assert.ok(await page.locator('#detailModal').isVisible());
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-detail-step="-1"]').click();
    assert.equal(await page.locator('#detailReason').inputValue(),'입력 보존 확인');
    assert.match(await page.locator('.detail-head b').innerText(),/리커전/);
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-detail-step="-1"]').click();
    await page.locator('.detail-head b').getByText('일라이 릴리',{exact:true}).waitFor();
    await page.locator('#detailClose').click();
    assert.equal(await page.locator('[data-stock-period="오늘"]').getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Complete a decision after a lost write response, then reopen its persisted record.
    await page.evaluate(args=>window.__uiFixture(...args),[{...live,decisionSaveFixture:true},decision,analysis,comparison]);
    await page.evaluate(()=>window.__uiDetail('s0'));await openOptionalTools(page);
    await page.locator('#detailDecisionAction').click();
    await page.locator('#detailChoice').selectOption('hold');
    await page.locator('#detailChoice').selectOption(decision.choice);
    await page.locator('#detailReuseReason').click();
    assert.equal(await page.locator('#detailReason').inputValue(),decision.reason);
    await page.locator('#detailReason').fill('수정 중인 이유');await page.locator('#detailReuseReason').click();
    assert.equal(await page.locator('#detailReason').inputValue(),'수정 중인 이유');
    await page.locator('#detailChoice').selectOption('hold');
    await page.locator('[data-review-days="7"]').click();
    const nextDay=await page.evaluate(()=>{const d=new Date(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10)});
    assert.equal(await page.locator('#detailReview').inputValue(),nextDay);
    assert.equal(await page.evaluate(()=>window.__decisionWrites),0,'shortcuts only edit the draft');
    await page.locator('#detailReason').fill('매출 성장 근거를 다음 실적에서 다시 확인');
    await page.locator('#detailReview').fill('다음 실적 발표 후 확인');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    await page.locator('#detailDecisionDone').waitFor().catch(async e=>{throw Error(e.message+'; save status: '+await page.locator('#detailDecisionStatus').innerText())});
    assert.equal(await page.evaluate(()=>window.__decisionWrites),1,'lost response must not replay the write');
    assert.match(await page.locator('#detailDecisionSummary').innerText(),/매출 성장 근거/);
    const change=page.locator('#detailDecisionSummary .decision-change');
    assert.equal(await change.evaluate(el=>el.open),false,'comparison starts collapsed');
    await change.locator('summary').click();
    assert.match(await change.innerText(),/이유.*변경/s);
    assert.ok((await change.innerText()).includes(decision.reason));
    assert.ok((await change.innerText()).includes('매출 성장 근거를 다음 실적에서 다시 확인'));
    await page.screenshot({path:out+'/decision-recovered-'+width+'.png'});
    await page.locator('#detailDecisionDone').click();
    await page.evaluate(()=>window.__uiDetail('s0'));await openOptionalTools(page);
    assert.match(await page.locator('#detailDecisionSummary').innerText(),/매출 성장 근거/);
    await page.locator('#detailClose').click();
    assert.deepEqual(errors,[],errors.join('\n'));if(!process.env.CHROMIUM_PATH)await page.close();
  }
}finally{await browser.close()}
console.log('Build 67: same fixture, five production screens, 390/402/430, 125%, chart touch and keyboard passed');
