import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// The same production detail component runs against an isolated owner-scoped fixture.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
const start=html.indexOf('  function comparisonHtml('),end=html.indexOf('  function empty(',start);
assert.ok(start>0&&end>start);
const closeBinding=html.match(/var close=document\.getElementById\('detailClose'\);if\(close\)close\.onclick=closeSecurityDetail/)?.[0];
assert.ok(closeBinding,'test the close binding used by the real page');
mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
    await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${styles}.detail-modal{--detail-safe-top:59px}.test-status-bar{position:fixed;inset:0 0 auto;height:59px;z-index:100;background:#ced5db;pointer-events:auto}</style><main class="shell"><div id="detailModal" class="detail-modal hidden"><div class="detail-sheet"><div class="detail-head"><div><b>종목 상세</b><div class="sub">보유 상태 · 내 논리 · 판단</div></div><button id="detailClose" class="close-btn" aria-label="닫기">×</button></div><div id="detailBody"></div></div></div></main><div class="test-status-bar" aria-hidden="true"></div>`);
    await page.evaluate(({source,binding})=>{
      const fake=`
        var live={securityMap:{held:{id:'held',symbol:'TEST',name:'First issuer',currency:'USD'},other:{id:'other',symbol:'NEXT',name:'Second issuer',currency:'USD'}},
          holdings:[{security_id:'held',quantity:10,account_id:'own',as_of:'2026-09-26'},
            {security_id:'other',quantity:4,account_id:'own',as_of:'2026-09-26'}],
          holdingBasis:[{security_id:'held',account_id:'own',valuation_krw:10000,pnl_krw:500},
            {security_id:'other',account_id:'own',valuation_krw:4000,pnl_krw:-100}],accounts:[{id:'own',name:'Fixture only'}],settlementBasis:[],
          decisionMetrics:{ok:true,position:{symbol:'TEST',weight_pct:20}}};
        var currentTab="portfolio",detailEpoch=0,stored=[],readbackIncomplete=true,SUPABASE_URL='https://example.invalid',SUPABASE_KEY='test-only';
        var edgeSync=async()=>({ok:true}),loadLive=async()=>live;
        var esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
        var num=(x,d)=>Number(x).toFixed(d),money=x=>Math.round(Number(x)).toLocaleString('ko-KR')+'원',pct=x=>Number(x).toFixed(2)+'%';
        var finiteMetric=x=>x==null||x===''?NaN:Number(x);
        var signedMoney=x=>(Number(x)>0?'+':'')+money(x),amountHtml=money,cls=()=>'',price=money,kstStamp=String,weightPct=x=>Number(x).toFixed(1)+'%';
        var metric=(name,value)=>'<div class="metric"><span>'+name+'</span><b>'+value+'</b></div>';
        var securityChart=()=>'',interpretTechnical=()=>'',thesisEditor=()=>'<form id="thesisForm"><textarea data-thesis-field="rationale"></textarea><button type="submit">저장</button><span id="thesisStatus"></span></form>';
        var lastAiRequest=null,analysisCallCount=0;
        var authFetch=async(_url,options)=>{if(options&&options.method==='POST'){
          lastAiRequest=JSON.parse(options.body);analysisCallCount++}return {ok:true,json:async()=>options&&options.method==='POST'?{
          answer:'판단: 내 조건과 비교해야 합니다.\\n근거: 기록된 종가만 검증했습니다.\\n선택지: 목표 비중을 선택합니다.\\n다음 확인: 내 기준을 적습니다.',
          analysis_id:'analysis-for-'+JSON.parse(options.body).symbol,history_saved:true,
          response_kind:'validated_fallback',observation_at:'2026-09-26T12:10:00Z',external_sources:[]}:[]}};
        if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=> '12345678-1234-4234-8234-123456789abc'});
        var rpc=async function(name,p){
          if(name==='get_live_security_detail')throw Error('security not found');
          if(name==='get_live_security_activity')return {items:[]};
          if(name==='get_investment_thesis')return {thesis:{version:1,rationale:p.p_security_id==='held'?'My TEST reason':'My NEXT reason'}};
          if(name==='get_investment_decisions'){var rows=stored.filter(x=>x.security_id===p.p_security_id);if(rows.length&&readbackIncomplete){readbackIncomplete=false;return rows.map(x=>({...x,scenario_snapshot:{}}))}return rows}
          if(name==='save_investment_decision'&&p.p_security_id==='other'){stored.unshift({...p,id:'other-fixture',security_id:'other',reason:p.p_reason,review_condition:p.p_review_condition,choice:p.p_choice,analysis_id:p.p_analysis_id,created_at:'2026-09-27',scenario_snapshot:{}});return {ok:true,id:'other-fixture'}}
          if(name==='save_investment_decision'){if(!stored.length)stored.unshift({...p,id:'fixture-id',security_id:p.p_security_id,reason:p.p_reason,review_condition:p.p_review_condition,choice:p.p_choice,analysis_id:p.p_analysis_id,created_at:'2026-09-26',scenario_snapshot:{choice_comparison:{target_pct:p.p_target_pct,price_assumptions:{down_pct:p.p_down_pct,up_pct:p.p_up_pct},observation_at:p.p_observation_at,hold:{value_krw:10000},reduce:{mode:'integer_shares',shares_to_sell:5,cash_increase_krw:5000}}}});else if(stored[0].p_request_id!==p.p_request_id)throw Error('retry created a new decision');return {ok:true,id:'fixture-id'}};
          if(name==='get_live_decision_metrics'){var value=p.p_symbol==='TEST'?10000:4000;return {
            ok:true,observation_at:'2026-09-26T12:10:00Z',denominator:{value:50000},position:{symbol:p.p_symbol,value:value},
            scenario:{assumption_pct:p.p_change_pct,impact_krw:value*p.p_change_pct/100}}};
          if(name==='get_live_choice_comparison')return {ok:true,observation_at:'2026-09-26',denominator:{value:50000},assets_before_krw:50000,current_cash_kb_krw:null,
            price_assumptions:{down_pct:p.p_down_pct,up_pct:p.p_up_pct},
            hold:{quantity:10,value_krw:10000,weight_pct:20,down_impact_krw:-1000,up_impact_krw:1000},
            reduce:{mode:'integer_shares',shares_to_sell:5,quantity_reference:5,value_krw:5000,weight_pct:10,cash_increase_krw:5000,down_impact_krw:-500,up_impact_krw:500}};
          throw Error('unexpected '+name)
        };
      `;
      (0,eval)(fake+source+'\nwindow.openTestDetail=openSecurityDetail');
      (0,eval)(binding);
      window.openTestDetail('held');
    },{source:html.slice(start,end)+html.slice(html.indexOf('  function opinionDeadline('),html.indexOf('  function fetchTimeout(')),binding:closeBinding});
    await page.getByText('My TEST reason').first().waitFor({timeout:8000}).catch(()=>{
      throw Error(`${width}px stock detail did not render: ${pageErrors.join('; ')||'no browser error'}`)});
    const sections=await page.locator('#detailBody').evaluate(node=>Array.from(node.children).filter(x=>x.id!=='detailStart').map(x=>x.querySelector('h3')?.textContent||x.querySelector('summary')?.textContent||''));
    const position=label=>sections.findIndex(x=>x.includes(label));
    assert.ok(position('현재 상태')<position('내 보유 이유')&&position('내 보유 이유')<position('AI 의견')&&
      position('AI 의견')<position('일부 팔면')&&position('일부 팔면')<position('내 결정 기록')&&
      position('내 결정 기록')<position('가격 차트'),`${width}px: reason, AI opinion, comparison, decision precede detailed evidence`);
    assert.ok(await page.locator('.detail-overview').getByText('10,000원').isVisible());
    await page.screenshot({path:`mobile-artifacts/build62-detail-overview-${width}.png`});
    const close=await page.locator('#detailClose').boundingBox();
    const title=await page.locator('.detail-head b').boundingBox();
    assert.ok(close.y>=59&&title.y>=59,`${width}px: title and X must clear the simulated iPhone status bar`);
    assert.ok(close.width>=44&&close.height>=44,`${width}px: X must have a finger-sized hit target`);
    await page.locator('.detail-head b').evaluate(node=>{node.textContent='에이알엠 홀딩스(ADR)';node.style.fontSize='24px'});
    const enlargedClose=await page.locator('#detailClose').boundingBox();
    assert.ok(enlargedClose.y>=59&&enlargedClose.x+enlargedClose.width<=width,
      `${width}px: enlarged stock title must not push X into the status bar or off screen`);
    await page.locator('#detailClose').click();
    assert.ok(await page.locator('#detailModal').evaluate(node=>node.classList.contains('hidden')),
      `${width}px: tapping the actual X binding must close the detail`);
    await page.evaluate(()=>window.openTestDetail('held'));
    await page.getByText('가격 차트와 기술지표').click();
    assert.ok(await page.getByText('추가 조회 실패').isVisible());
    assert.equal(await page.locator('#thesisAnalyze').isVisible(),false,
      'the secondary AI paths stay folded away from the main decision flow');
    await page.getByText('다른 질문으로 AI 의견 받기 (선택)').click();
    await page.locator('#thesisAnalyze').click();
    await page.getByText('−10%라면').waitFor();
    assert.match(await page.locator('#thesisAnalysis').textContent(),/−10%라면.*-1,000원.*\+10%라면.*\+1,000원/s);
    assert.match(await page.locator('#thesisAnalysis').textContent(),/서버 검증 답변 · 저장됨 · 계좌 관측/);
    assert.match(await page.locator('#thesisAnalysis').textContent(),/공식 기업 실적·공시는 이번 답변의 근거에 포함되지 않았습니다/);
    if(html.includes('compactDetailAnswer')){
      assert.equal(await page.locator('.detail-answer-evidence').getAttribute('open'),null);
      assert.match(await page.locator('.detail-answer-kind').innerText(),/AI 해석 아님/);
      await page.locator('#thesisAnalysis').scrollIntoViewIfNeeded();
      await page.screenshot({path:`mobile-artifacts/build84-answer-${width}.png`});
      const action=await page.getByRole('button',{name:'이 의견을 읽고 내 결정 기록'}).boundingBox();
      const impact=await page.getByText('−10%라면').boundingBox();assert.ok(action.y<impact.y);
      await page.locator('.detail-answer-evidence summary').first().click();
      assert.ok(await page.getByText('공식 기업 실적·공시는 이번 답변의 근거에 포함되지 않았습니다.').isVisible());
      await page.locator('.detail-answer-evidence summary').first().click();
    }
    await page.getByRole('button',{name:'이 의견을 읽고 내 결정 기록'}).click();
    assert.ok(await page.locator('#detailDecisionForm').isVisible(),
      `${width}px: the AI answer's decision shortcut must open the collapsed form`);
    await page.setViewportSize({width,height:560});
    await page.locator('#detailReview').focus();
    await page.locator('#detailDecisionForm button[type=submit]').scrollIntoViewIfNeeded();
    const saveButton=await page.locator('#detailDecisionForm button[type=submit]').boundingBox();
    assert.ok(saveButton&&saveButton.y>=0&&saveButton.y+saveButton.height<=560,
      `${width}px: decision save must remain reachable when the visible viewport shrinks for the keyboard`);
    await page.setViewportSize({width,height:844});
    await page.getByRole('button',{name:'일부 매도 시 금액 계산'}).click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'detailWeightTarget');
    assert.equal(await page.locator('#detailWeightResult').isVisible(),false,
      'do not show an empty result panel before the comparison');
    assert.equal(await page.locator('#detailDown').isVisible(),false,
      'advanced price assumptions stay out of the first reading path');
    await page.locator('#detailWeightTarget').fill('10');
    await page.locator('#detailWeightRun').click();
    await page.screenshot({path:`mobile-artifacts/choice-detail-${width}.png`});
    assert.match(await page.locator('#detailWeightResult').innerText(),
      /줄이면 하락 영향은 500원 작아지고, 상승 참여도 500원 줄어듭니다/);
    assert.ok(await page.locator('#detailWeightResult').getByText(/매도대금 원화 현금/).isVisible());
    assert.equal(await page.locator('#detailWeightResult details').first().evaluate(node=>node.open),false,
      'quantity and calculation policy remain available but collapsed');
    assert.ok(await page.locator('#detailWeightResult .choice-cards').getByText('+1,000원').isVisible());
    assert.ok(await page.locator('#detailWeightResult .choice-cards').getByText('-500원').isVisible());
    assert.match(await page.locator('#detailComparisonNext').innerText(),/이 조건으로 AI 의견 받기/);
    await page.locator('#detailWeightTarget').fill('9');
    assert.match(await page.locator('#detailWeightResult').innerText(),/조건이 바뀌었습니다. 다시 비교해 주세요/);
    await page.locator('#detailWeightTarget').fill('10');
    await page.locator('#detailDecisionAction').click();
    await page.locator('#detailReason').fill('I can absorb this exposure');
    await page.locator('#detailReview').fill('Recheck the reported operating result');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    assert.match(await page.locator('#detailDecisionStatus').innerText(),/다시 비교하거나 목표 비중을 지워/);
    await page.locator('#detailWeightRun').click();
    await page.locator('#thesisAnalyze').click();
    await page.getByText('저장됨 · 계좌 관측').last().waitFor({state:'attached'});
    await page.locator('#detailDecisionForm button[type=submit]').click();
    assert.match(await page.locator('#detailDecisionStatus').innerText(),/비교 조건으로 AI 의견/,
      'a generic thesis answer cannot authorize a different comparison');
    await page.locator('#detailComparisonNext').click();
    await page.getByText('저장됨 · 계좌 관측').last().waitFor({state:'attached'});
    assert.deepEqual(await page.evaluate(()=>({action:lastAiRequest.action,target:lastAiRequest.target_pct})),
      {action:'decision-review',target:10},'the next step must review the current comparison, not an old target');
    assert.match(await page.locator('#detailComparisonNext').innerText(),/이 의견으로 내 판단 남기기/);
    // A broad dashboard read must not override the authenticated per-symbol
    // calculation or falsely report that a holding disappeared.
    await page.evaluate(()=>{
      window.__loadLiveBeforeReadFailure=loadLive;
      loadLive=async()=>{liveError='ONE_DASHBOARD_READ_FAILED';live={...live,holdings:[]}};
    });
    await page.locator('#detailFreshReview').click();
    await page.getByText('전체 목록 조회에 실패했으나 종목별 비교는 서버의 새 계좌 관측으로 확인했습니다.').waitFor();
    await page.getByText('저장됨 · 계좌 관측').last().waitFor({state:'attached'});
    assert.match(await page.locator('#detailWeightResult').innerText(),/5주 매도 가정.*5주 보유/);
    assert.doesNotMatch(await page.locator('#detailWeightResult').innerText(),/보유되지 않습니다/);
    await page.evaluate(()=>{loadLive=window.__loadLiveBeforeReadFailure;liveError=null});
    await page.evaluate(()=>{document.getElementById('detailDecisionForm').hidden=true});
    await page.locator('#detailComparisonNext').click();
    assert.ok(await page.locator('#detailDecisionForm').isVisible(),
      'after the linked AI opinion, one tap opens the decision form');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    await page.waitForFunction(()=>/판단 저장 실패/.test(document.getElementById('detailDecisionStatus').textContent));
    assert.equal(await page.locator('#detailReason').inputValue(),'I can absorb this exposure');
    assert.equal(await page.locator('#detailDecisionDone').count(),0,'unverified save must not show completion');
    assert.equal(await page.locator('#detailReview').inputValue(),'Recheck the reported operating result');
    await page.evaluate(()=>document.getElementById('detailDecisionStatus').textContent='');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    await page.waitForFunction(()=>/저장 완료|저장 실패/.test(document.getElementById('detailDecisionStatus').textContent));
    const saveMessage=await page.locator('#detailDecisionStatus').textContent();
    assert.match(saveMessage,/내 판단 저장 완료/,saveMessage);
    assert.equal(await page.evaluate(()=>stored[0].p_analysis_id),'analysis-for-TEST',
      'the user decision links to the saved analysis for the selected security');
    assert.equal(await page.evaluate(()=>stored[0].p_target_pct),10,
      'the compared target is stored with the decision');
    assert.equal(await page.evaluate(()=>stored[0].p_observation_at),'2026-09-26',
      'the decision must refer to the same observed comparison');
    if(html.includes('detailDecisionDone')){
      await page.getByRole('button',{name:'목록으로 돌아가기',exact:true}).click();
      assert.ok(await page.locator('#detailModal').evaluate(el=>el.classList.contains('hidden')));
    }
    await page.evaluate(()=>window.openTestDetail('held'));
    await page.locator('#detailDecisionSummary').waitFor({state:'attached'});
    await page.locator('#detailDecisionReview').waitFor({state:'attached'});
    assert.match(await page.locator('#detailDecisionReview').textContent(),/I can absorb this exposure/);
    assert.match(await page.locator('#detailDecisionSummary').textContent(),/현재 유지.*Recheck the reported operating result/);
    assert.equal(await page.locator('#detailWeightTarget').inputValue(),'',
      'a prior comparison is an optional assumption, not an automatically approved target');
    assert.equal(await page.locator('#detailPreviousComparison').evaluate(node=>node.open),false,
      'the old target assumption stays folded away from the current decision path');
    await page.locator('#detailPreviousComparison summary').click();
    assert.match(await page.locator('#detailPreviousComparison').innerText(),/지난 판단에 연결된 10% 비교 가정.*적정 비중이나 승인된 투자 원칙은 아닙니다/s);
    const callsBeforeReuse=await page.evaluate(()=>analysisCallCount);
    await page.locator('#detailPreviousComparison button').click();
    await page.waitForFunction(previous=>analysisCallCount>previous,callsBeforeReuse);
    assert.equal(await page.locator('#detailWeightTarget').inputValue(),'10');
    assert.match(await page.locator('#detailWeightResult').innerText(),/5주 매도 가정/);
    assert.deepEqual(await page.evaluate(()=>({action:lastAiRequest.action,target:lastAiRequest.target_pct,
      down:lastAiRequest.down_pct,up:lastAiRequest.up_pct})),
      {action:'decision-review',target:10,down:-10,up:10},
      'a deliberate tap recomputes and requests a new AI review with the same saved assumption');
    await page.evaluate(()=>window.openTestDetail('other'));
    await page.getByText('My NEXT reason').first().waitFor();
    assert.equal(await page.getByText('My TEST reason').count(),0);
    assert.equal(await page.getByText('I can absorb this exposure').count(),0);
    assert.equal(await page.locator('#detailPreviousComparison').count(),0,
      'a saved assumption must never spill into another security');
    await page.locator('#detailFreshReview').click();
    await page.getByText('저장됨 · 계좌 관측').last().waitFor({state:'attached'});
    assert.match(await page.locator('#detailWeightResult').innerText(),/목표 비중 없이 기록/);
    await page.locator('#detailDecisionAction').click();
    await page.locator('#detailReason').fill('Second stock hold, no target');
    await page.locator('#detailReview').fill('Review source evidence again');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    await page.waitForFunction(()=>/내 판단 저장 완료/.test(document.getElementById('detailDecisionStatus').textContent));
    assert.equal(await page.evaluate(()=>stored[0].p_target_pct),null,'hold can be saved without a comparison target');
    assert.equal(await page.evaluate(()=>stored[0].p_analysis_id),'analysis-for-NEXT');
    await page.evaluate(()=>window.openTestDetail('other'));
    await page.locator('#detailDecisionSummary').waitFor({state:'attached'});
    assert.match(await page.locator('#detailDecisionSummary').innerText(),/비교 없이 기록한 판단/);
    await page.evaluate(()=>{
      const original=window.rpc;
      window.rpc=(name,args)=>name==='get_live_security_detail'&&args.p_security_id==='held'
        ?new Promise(resolve=>setTimeout(()=>resolve({ok:false,detailWarning:'Delayed first stock'}),160))
        :original(name,args);
      window.openTestDetail('held');window.openTestDetail('other');
    });
    await page.getByText('My NEXT reason').first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.getByText('My TEST reason').count(),0,
      'an old detail response must not replace the newly selected stock');
    await page.evaluate(()=>{
      const original=window.authFetch;
      window.authFetch=(url,options)=>options?.method==='POST'&&JSON.parse(options.body).symbol==='TEST'
        ?new Promise(resolve=>setTimeout(()=>resolve({ok:true,json:async()=>({answer:'OLD STOCK ANSWER',
          analysis_id:'stale-id',history_saved:true,response_kind:'model',external_sources:[]})}),160))
        :original(url,options);
      window.openTestDetail('held');
    });
    await page.getByText('My TEST reason').first().waitFor();
    await page.getByText('다른 질문으로 AI 의견 받기 (선택)').click();
    await page.locator('#thesisAnalyze').click();
    await page.evaluate(()=>window.openTestDetail('other'));
    await page.getByText('My NEXT reason').first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.getByText('OLD STOCK ANSWER').count(),0,
      'a late model answer must not appear under a different security');
    const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(over,false,`${width}px stock detail should not overflow`);
    await page.evaluate(()=>document.documentElement.style.zoom='1.25');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,
      `${width}px stock detail must stay within the viewport at 125% zoom`);
    await page.close();
  }
}finally{await browser.close()}
console.log('Detail keeps thesis after quote failure; isolated choice, decision and second stock work at 390/402/430px');
