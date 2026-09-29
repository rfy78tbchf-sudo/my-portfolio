import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {chromium} from 'playwright';

// Production HTML, CSS, renderers and handlers; isolated deterministic data only.
// No owner login, network or records are used or changed by this visual test.
const source=readFileSync(process.env.UI_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const baseline=!!process.env.UI_BASELINE;
if(!baseline){await import('./build72_app_update.mjs');await import('./build73_recent_sales.mjs');}
const denseUi=source.includes('contribution-toggle');
// Exercise the real refresh lifecycle, which the previous static fixture missed.
if(!process.env.UI_BASELINE){
 const fn=source.slice(source.indexOf('  function refreshLive('),source.indexOf('  (function bindPullToRefresh'));
 for(const fail of [false,true]){
  const labels=[],button={set textContent(v){labels.push(v)},setAttribute(){},disabled:false};
  const indicator={classList:{add(){},remove(){}}};
  const ctx={mode:'live',document:{visibilityState:'visible',getElementById:id=>id==='refreshBtn'?button:indicator},liveRefreshPromise:null,lastLiveLoadAt:0,currentTab:'home',window:{scrollY:0,scrollTo(){}},edgeSync:()=>Promise.resolve(),syncRecentHistory:()=>Promise.resolve(),loadLive:()=>fail?Promise.reject(new Error('isolated failure')):Promise.resolve(),live:{},render(){},setTimeout(){}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.refreshLive(true,true).catch(()=>{});
  assert.ok(labels.length>=2);assert.ok(labels.every(x=>x==='↻'),'refresh must stay an icon during load and after success/failure');assert.equal(button.disabled,false);
 }
}

const out=process.env.UI_OUTPUT||'mobile-artifacts/build67';mkdirSync(out,{recursive:true});
const names=[['ARM','에이알엠 홀딩스(ADR)',32,12472000,-534000],['RXRX','리커전 파머슈티컬스',2100,10812500,426000],['MRNA','모더나',40,9627400,672000],['LLY','일라이 릴리',3,5138000,218000],['MU','마이크론 테크놀로지',3,4437100,-67000],['META','메타 플랫폼스',4,4146000,114000],['385560','RISE KIS국고채30년Enhanced',110,7822100,322100]];
const now='2026-09-28T22:10:00Z';
const live={accounts:[{id:'broker',name:'KB 종합위탁',mode:'live'},{id:'isa',name:'ISA',mode:'live'}],securityMap:{},securities:[],holdings:[],holdingBasis:[],settings:{},manualSnapshots:[],settlementBasis:[],transactions:[],reviewDecisions:[],reviewAnalyses:[],
  snapshots:[{snapshot_at:now,snapshot_date:'2026-09-29',total_assets:63842170,securities_value:54455100,unrealized_pnl:1151100}],
  accountScope:{ok:true,current_display_total:63842170,snapshot_at:now,overlay_matches_manual:true,broker_account_overlap_verified:true,current_primary_value:56020070,current_isa_value:7822100,current_primary_observed_at:now,current_isa_capture_at:'2026-09-26T02:42:00Z',current_isa_source:'kb_account_breakdown_screenshot'},
  performancePeriod:'1M',performance:{ok:true,return_ready:true,investment_pnl:326840,return_pct:.52,period_start:'2026-08-29',period_end:'2026-09-29',realized_pnl:251200,dividends_net:42000},
  performanceGate:{ok:true,state:'estimated',partial:false,reliable_start:'2026-08-29',observed_through:'2026-09-29',investment_pnl:326840,return_estimate_pct:.52,opening_assets:62810330,closing_assets:63842170,external_flow:705000,as_of:now},
  homeChart:{items:[{date:'2026-08-29',total_assets:62810330},{date:'2026-09-04',total_assets:63221000},{date:'2026-09-10',total_assets:61986500},{date:'2026-09-16',total_assets:62178000},{date:'2026-09-22',total_assets:63576900},{date:'2026-09-29',total_assets:63842170}]},
  securityPerformance:{items:[{symbol:'LLY',name:'일라이 릴리',confirmed_contribution:243200,realized_pnl:231200,dividend_net:12000},{symbol:'META',name:'메타 플랫폼스',confirmed_contribution:86000,realized_pnl:76000,dividend_net:10000},{symbol:'ARM',name:'에이알엠 홀딩스(ADR)',confirmed_contribution:-72000,realized_pnl:-72000,dividend_net:0}]}}
for(const [i,[symbol,name,quantity,value,pnl]] of names.entries()){const id='s'+i,currency=i===6?'KRW':'USD',account_id=i===6?'isa':'broker';live.securityMap[id]={id,symbol,name,currency,market:i===6?'KRX':'NAS'};live.securities.push(live.securityMap[id]);live.holdings.push({security_id:id,account_id,quantity,as_of:now,currency,market_value:value,fx_rate_to_base:1});live.holdingBasis.push({security_id:id,account_id,valuation_krw:value,cost_krw:value-pnl,pnl_krw:pnl,quantity,as_of:now})}
const comparison={target_pct:10,price_assumptions:{down_pct:-10,up_pct:10},observation_at:now,denominator:{value:63842170},assets_before_krw:63842170,position_currency:'USD',hold:{quantity:32,value_krw:12472000,weight_pct:19.53,down_impact_krw:-1247200,up_impact_krw:1247200},reduce:{mode:'integer_shares',shares_to_sell:16,quantity_reference:16,value_krw:6236000,weight_pct:9.77,cash_increase_krw:6236000,down_impact_krw:-623600,up_impact_krw:623600,cash_native_estimate:4570}};
const decision={id:'isolated-ui-decision',security_id:'s0',choice:'consider_reduction',reason:'눌림목을 살펴보고 보유 전제가 약해지면 축소 검토',review_condition:'눌림목 모니터링',analysis_id:'isolated-ui-analysis',created_at:now,basis_at:now,thesis_version:1,price_snapshot:{price_date:'2026-09-28',close:285,currency:'USD'},account_snapshot:{observation_at:now},scenario_snapshot:{choice_comparison:comparison}};
const analysis={id:'isolated-ui-analysis',symbol:'ARM',created_at:now,thesis_version:1,response_kind:'model_interpretation_server_metrics',answer:'판단: 저장한 유지 조건이 약해졌다면 축소를 검토하되, 기준을 확인하기 전에는 현재 판단을 유보합니다.\n근거: 가격 참고 고점만으로 사용자의 돌파 조건을 확정할 수 없습니다.\n선택지: 일부 축소는 하락 영향과 상승 참여를 함께 줄입니다.\n다음 확인: 사용자가 정한 보유 조건과 다음 종가를 대조합니다.',comparison_evidence:comparison,price_evidence:{ready:true,price_date:'2026-09-28',latest_close:285,currency:'USD'},external_sources:[]};
const injected=`
  window.__uiFixture=function(data,record,opinion,comparison){
    live=data;liveError=null;mode='live';period='1M';session=null;
    rpc=async function(name,p){
      if(name==='get_live_security_detail')return {ok:true,security:live.securityMap[p.p_security_id],holding:{quantity:32},technical:{},prices:[{date:'2026-09-25',close:297,currency:'USD'},{date:'2026-09-28',close:285,currency:'USD'}]};
      if(name==='get_pending_kb_position_events')return [{symbol:'TEST',type:'sell',order_date:kstDaysAgo(1),settlement_date:kstDate(),quantity:7}];
      if(name==='get_live_security_activity')return {items:[]};
      if(name==='get_investment_thesis')return {ok:true,thesis:data.testThesis||{version:1,rationale:'최근 추세돌파와 상승 흐름을 확인하며 보유',updated_at:record?record.created_at:'2026-09-28T22:10:00Z'}};
      if(name==='get_investment_decisions')return record?[record]:[];
      if(name==='get_investment_breakout_rule')return null;
      if(name==='get_live_choice_comparison')return {...comparison,ok:true};
      if(name==='get_live_decision_metrics')return {ok:false};
      return {ok:false,items:[]};
    };
    authFetch=async function(url,options){if(options&&options.method==='POST')throw Error('No model generation or writes allowed in UI capture');return {ok:true,json:async()=>[opinion]}};
    loadLive=async()=>{};edgeSync=async(action)=>{if(action==='overseas-day-pnl')return {ok:true,available:false,items:[]};throw Error('No account sync during UI capture')};
    document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.getElementById('refreshBtn').classList.remove('hidden');
    window.__uiRender=function(tab){currentTab=tab;render()};window.__uiDetail=openSecurityDetail;
    render();
  };
`;
let html=source.replace('  restoreLogin();',injected).replace(/<script[^>]+src=[^>]+><\/script>/g,'').replace("navigator.serviceWorker.register('./sw.js'","Promise.reject('fixture only').then('./sw.js'");
// Keep the application's actual AI response renderer as well.
html=html.replace('</body>',`<script>${readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8')}</script></body>`);
writeFileSync(out+'/fixture.html',html);
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:(await import('@sparticuz/chromium')).default.args}:{} )});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.abort());await page.setContent(html,{waitUntil:'domcontentloaded'});
    const fontFile=resolve('node_modules/@fontsource/noto-sans-kr/400.css');
    if(existsSync(fontFile)){const css=readFileSync(fontFile,'utf8').replace(/url\(([^)]+)\)/g,(_,p)=>`url(data:font/woff2;base64,${readFileSync(resolve(dirname(fontFile),p.replaceAll("'",''))).toString('base64')})`);await page.addStyleTag({content:css+' body{font-family:"Noto Sans KR",sans-serif}'});await page.evaluate(()=>document.fonts.ready)}
    await page.evaluate(args=>window.__uiFixture(...args),[live,decision,analysis,comparison]);
    for(const tab of ['home','portfolio','performance']){
      await page.evaluate(tab=>window.__uiRender(tab),tab);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} ${width}px overflow`);
      if(tab==='home'&&!baseline){const rows=await page.locator('#homeHoldings .portfolio-row').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().bottom));assert.ok(rows[2]<760,`${width}px at least three home rows visible`)}
      if(tab==='portfolio'&&!baseline){const rows=await page.locator('.portfolio-row').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().bottom));assert.ok(rows[4]<770,`${width}px five portfolio rows visible`)}
      await page.screenshot({path:`${out}/${tab}-${width}.png`});
      if(tab==='performance'&&source.includes('brokerDayCard')){await page.locator('#brokerDayResult').getByText('TEST',{exact:true}).waitFor();await page.locator('#brokerDayCard').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/sales-${width}.png`});}
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
        await page.locator('#search').fill('');
      }

      if(width===390){await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} 125% overflow`);await page.screenshot({path:`${out}/${tab}-390-large.png`});await page.evaluate(()=>document.documentElement.style.zoom='')}
    }
    if(denseUi){
      await page.evaluate(()=>{window.__uiRender('portfolio');document.querySelector('.position-name').textContent='아주 긴 국내 상장 종목 이름을 확인하는 화면';document.querySelector('.position-value').textContent='1,234,567,890원'});
      await page.evaluate(()=>document.documentElement.style.zoom='1.25');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'long names / billion amount / enlarged text');await page.screenshot({path:`${out}/stress-${width}.png`});await page.evaluate(()=>document.documentElement.style.zoom='');
    }
    await page.evaluate(()=>window.__uiRender('home'));
    if(await page.locator('#homeTrend').count()){await page.locator('#homeTrend').scrollIntoViewIfNeeded();await page.evaluate(()=>document.getElementById('homeTrend').scrollIntoView({block:'start'}))}
    else{await page.getByRole('heading',{name:/자산 추이/}).scrollIntoViewIfNeeded();await page.getByRole('heading',{name:/자산 추이/}).evaluate(el=>el.closest('section').scrollIntoView({block:'start'}))}
    await page.screenshot({path:`${out}/trend-${width}.png`});
    await page.locator('#assetChartHit').tap();assert.ok(await page.locator('#assetChartTip').isVisible(),'chart observation is touch-readable');
    await page.evaluate(()=>window.__uiDetail('s0'));await page.locator('#detailDecisionSummary').waitFor();await page.getByText('눌림목을 살펴보고').first().waitFor();
    assert.equal(await page.locator('#detailDecisionForm').isVisible(),false,'saved judgment precedes form');
    await page.screenshot({path:`${out}/detail-${width}.png`});
    if(source.includes("startPanel.id='detailStart'")){
      if(width===390){await page.locator('.detail-usage').evaluate(x=>x.open=true);await page.screenshot({path:`${out}/detail-guide-${width}.png`});await page.locator('.detail-usage').evaluate(x=>x.open=false)}
      await page.locator('#detailStartAction').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'detailDecisionSummary');
    }
    await page.locator('#detailDecisionSummary').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/judgment-${width}.png`});
    if(source.includes('brokerDayCard')){await page.locator('#detailDecisionReview').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/review-${width}.png`});}
    await page.locator('#detailDecisionAction').click();assert.ok(await page.locator('#detailDecisionForm').isVisible());
    await page.setViewportSize({width,height:500});await page.locator('#detailReason').fill('검증 중 작성한 이유');await page.locator('#detailDecisionForm button[type=submit]').scrollIntoViewIfNeeded();const save=await page.locator('#detailDecisionForm button[type=submit]').boundingBox();assert.ok(save.y>=0&&save.y+save.height<=500,'save reachable with simulated keyboard');
    if(source.includes("startPanel.id='detailStart'")&&width===390){
      await page.setViewportSize({width,height:844});
      await page.evaluate(args=>window.__uiFixture(...args),[live,null,analysis,comparison]);await page.evaluate(()=>window.__uiDetail('s0'));
      await page.getByRole('button',{name:'AI 의견부터 확인하기'}).waitFor();await page.screenshot({path:`${out}/detail-first-review-${width}.png`});
      await page.locator('#detailStartAction').click();assert.ok(await page.locator('#detailFreshReview').isVisible());
      if(source.includes('detailDirectDecision')){
        await page.locator('#detailDirectDecision').click();assert.ok(await page.locator('#detailDecisionForm').isVisible());
        await page.locator('#detailChoice').selectOption('hold');assert.match(await page.locator('#detailChoiceGuide').innerText(),/목표 비중 없이/);
        await page.locator('#detailReason').fill('비교 후에도 보존할 작성 이유');
        await page.locator('#detailChoice').selectOption('consider_reduction');await page.getByRole('button',{name:'매도 수량 비교하기',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.activeElement.id),'detailWeightTarget');
        assert.equal(await page.locator('#detailReason').inputValue(),'비교 후에도 보존할 작성 이유');
        await page.locator('#detailDecisionAction').click();await page.screenshot({path:`${out}/decision-guide-${width}.png`});
      }
      const noReason={...live,testThesis:{version:0,rationale:''}};
      await page.evaluate(args=>window.__uiFixture(...args),[noReason,null,analysis,comparison]);await page.evaluate(()=>window.__uiDetail('s0'));
      await page.getByRole('button',{name:'먼저 보유 이유 적기'}).waitFor();await page.locator('#detailStartAction').click();assert.ok(await page.locator('[data-thesis-field="rationale"]').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-thesis-field')),'rationale');
    }
    assert.deepEqual(errors,[],errors.join('\n'));if(!process.env.CHROMIUM_PATH)await page.close();
  }
}finally{await browser.close()}
console.log('Build 67: same fixture, five production screens, 390/402/430, 125%, chart touch and keyboard passed');
