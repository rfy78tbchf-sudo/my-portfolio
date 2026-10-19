import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

// Real HTML startup, stored-session auth, API queues, decision submission and rendering.
// The route handler is a synthetic server. No app business function is replaced, and
// every request is fulfilled/aborted locally, including all reads and simulated writes.
// This does not exercise production SQL, a physical iPhone, or new model generation.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'index.html'),'utf8');
const apiOrigin=source.match(/var SUPABASE_URL='([^']+)'/)[1];
const site='https://decision.portfolio.test/';
const output=resolve(root,process.env.UI_OUTPUT||'mobile-artifacts/build211-decision');
mkdirSync(output,{recursive:true});
const hook=`
  window.__decisionBrowser={state:function(){return {
    idle:!liveRefreshPromise&&!liveLoadPromise&&!liveResumePromise&&!liveReadsActive&&!liveReadQueue.length,
    loadEpoch:liveLoadEpoch,error:liveError
  }}};
`;
assert.ok(source.includes('  restoreLogin();'));
const html=source.replace('  restoreLogin();',hook+'  restoreLogin();');

// Follow the checked-in RPC projection instead of giving mocks extra fields that
// the real function cannot return. An override supports reproducing the old contract.
const contracts=readdirSync(resolve(root,'supabase')).filter(f=>/^build\d+.*\.sql$/.test(f))
  .map(file=>({file,build:Number(file.match(/^build(\d+)/)[1]),sql:readFileSync(resolve(root,'supabase',file),'utf8')}))
  .filter(x=>/function\s+public\.get_investment_decisions\s*\(/i.test(x.sql)).sort((a,b)=>b.build-a.build);
const contract=process.env.UI_DECISION_SQL?{file:process.env.UI_DECISION_SQL,sql:readFileSync(resolve(root,process.env.UI_DECISION_SQL),'utf8')}:contracts[0];
assert.ok(contract,'a checked-in decision history RPC contract is required');
const projection=contract.sql.match(/function\s+public\.get_investment_decisions\s*\([\s\S]*?from\s*\(select\s+([\s\S]*?)\s+from\s+public\.investment_decisions\s+d/i)?.[1];
assert.ok(projection,'get_investment_decisions must expose an explicit row projection');
const historyFields=[...projection.matchAll(/\bd\.([a-z_]+)/g)].map(m=>m[1]);
const project=(row,fields)=>Object.fromEntries(fields.map(k=>[k,row[k]??null]));
const copy=value=>JSON.parse(JSON.stringify(value));
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const before=n=>new Date(Date.parse(day+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
const now=day+'T00:00:00Z';
const securities=[['ARM','ARM 검증 종목'],['MRNA','MRNA 검증 종목'],['MU','MU 검증 종목'],['005930','국내 검증 종목']]
  .map(([symbol,name],i)=>({id:'00000000-0000-4000-8000-00000000000'+i,symbol,name,currency:i===3?'KRW':'USD',market:i===3?'KRX':'NAS',country:i===3?'KR':'US'}));
const accounts=[{id:'10000000-0000-4000-8000-000000000000',name:'격리 검증 계좌',provider:'kb_securities',base_currency:'KRW',mode:'live',is_active:true}];
const holdings=securities.map((s,i)=>({account_id:accounts[0].id,security_id:s.id,quantity:10,as_of:now,currency:s.currency,market_value:1000000-i*100000,avg_cost:90000,market_price:100000,unrealized_pnl:100000,fx_rate_to_base:1}));
const basis=holdings.map(h=>({...h,valuation_krw:h.market_value,cost_krw:h.market_value-100000,pnl_krw:100000,rate_pct:10,average_unit_krw:(h.market_value-100000)/10,valued_unit_krw:h.market_value/10}));
const snapshots=Array.from({length:8},(_,i)=>({snapshot_date:before(i*3),snapshot_at:before(i*3)+'T00:00:00Z',total_assets:5400000-i*10000,cash:2000000,securities_value:3400000-i*10000,unrealized_pnl:400000,external_flow:0}));
const scope={ok:true,current_display_total:5400000,current_primary_value:5400000,current_isa_value:0,current_primary_observed_at:now,snapshot_at:now,broker_account_overlap_verified:true};
const prices=securities.flatMap((s,i)=>Array.from({length:24},(_,n)=>({security_id:s.id,price_date:before(n),observed_at:before(n)+'T00:00:00Z',close:120-i*10-n,currency:s.currency})));
const gate={ok:true,state:'estimated',partial:false,reliable_start:before(30),observed_through:day,investment_pnl:90000,return_estimate_pct:1.7,opening_assets:5310000,closing_assets:5400000,external_flow:0,as_of:now};
const summary={ok:true,return_ready:true,investment_pnl:90000,return_pct:1.7,period_start:before(30),period_end:day,realized_pnl:0,dividends_net:0};
const denominator={value:5400000,metric_id:'app_display_assets',label:'앱 합산 자산',kb_response_value:5400000,manual_overlay:0};
function metrics(symbol){const security=securities.find(s=>s.symbol===symbol)||securities[0],holding=holdings.find(h=>h.security_id===security.id);return {ok:true,observation_at:now,account_scope_state:'synthetic_same_observation',denominator,position:{symbol:security.symbol,value:holding.market_value,quantity:holding.quantity,weight_pct:holding.market_value/5400000*100}}}
const comparison={ok:true,target_pct:8,price_assumptions:{down_pct:-12.5,up_pct:17.5},observation_at:now,denominator,assets_before_krw:5400000,assets_after_before_cost_krw:5400000,position_currency:'USD',calculation_version:'isolated-integer-shares',
  hold:{quantity:10,value_krw:900000,weight_pct:100/6,down_impact_krw:-112500,up_impact_krw:157500},
  reduce:{mode:'integer_shares',shares_to_sell:6,quantity_reference:4,value_krw:360000,weight_pct:100/15,cash_increase_krw:540000,down_impact_krw:-45000,up_impact_krw:63000,cash_native_estimate:396},exact_target:{value_krw:432000}};
const priorAnalysis={id:'20000000-0000-4000-8000-000000000000',symbol:'MRNA',question:'격리된 기존 비교 의견',created_at:now,observation_at:now,thesis_version:1,response_kind:'model_interpretation_server_metrics',answer:'판단: 일부 매도 가정의 가격 변동 영향을 확인한 뒤 내 판단을 기록합니다.\n근거: 검증용으로 미리 저장된 의견입니다.',comparison_evidence:comparison,
  price_evidence:{ready:true,price_date:day,latest_close:110,currency:'USD'},account_basis:{symbol:'MRNA',position_value_krw:900000,denominator_value_krw:5400000,kb_response_value:5400000,isa_total_value:0,scope_state:'synthetic_same_observation',quantity:10},external_sources:[]};

for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const subject='decision-browser-'+name;
  const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:subject,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await context.addInitScript(({token,key})=>localStorage.setItem(key,JSON.stringify({accessToken:token,refreshToken:'synthetic-local-refresh',expiresAt:Date.now()+3600000})),{token:jwt,key:'my_portfolio_session_v2'});
  const calls=[],forbidden=[],errors=[],decisions=[],writes=[],dialogs=[];
  let loseNextSave=false,failReceiptLookup=false,failDecisionReads=false,recoverOnRetry=false,page;
  const json=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(value)});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.origin===new URL(site).origin){
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
      const file=resolve(root,'.'+url.pathname);
      if(file.startsWith(root+'/')&&existsSync(file)&&/\.(js|json|webmanifest|svg|png|ico)$/.test(file))return route.fulfill({contentType:extname(file)==='.js'?'text/javascript':extname(file)==='.svg'?'image/svg+xml':extname(file)==='.png'?'image/png':'application/json',body:readFileSync(file)});
      return route.fulfill({status:404,body:''});
    }
    if(url.origin!==apiOrigin){forbidden.push(url.origin);return route.abort()}
    if(method==='OPTIONS')return json(route,{});
    const path=url.pathname,body=method==='POST'?request.postDataJSON()||{}:{};
    if(path==='/auth/v1/passkeys/authentication/options')return json(route,{error_code:'passkey_disabled'},400);
    if(path==='/auth/v1/token')return json(route,{access_token:jwt,refresh_token:'synthetic-local-refresh',expires_in:3600});
    assert.equal(request.headers().authorization,'Bearer '+jwt,'production authFetch sends only the isolated session token');
    calls.push({path,body,query:url.search});
    if(path.startsWith('/functions/')){
      if(body.action==='overseas-day-pnl')return json(route,{ok:true,available:false,items:[]});
      if(body.action==='sync-target-prices'&&body.security_ids?.every(id=>securities.some(s=>s.id===id)))return json(route,{ok:true,results:[]});
      forbidden.push(path+':'+String(body.action||''));return json(route,{message:'Production writes and model calls are blocked'},403);
    }
    if(path.startsWith('/rest/v1/rpc/')){
      const rpc=path.split('/').pop();
      if(rpc==='save_investment_decision'){
        const originalWrite=writes.find(p=>p.p_request_id===body.p_request_id);
        writes.push(copy(body));
        assert.ok(securities.some(s=>s.id===body.p_security_id));
        assert.match(body.p_request_id,/^[a-f0-9-]{36}$/i,'the real submission creates an idempotency request ID');
        let row=decisions.find(d=>d.request_id===body.p_request_id);
        if(recoverOnRetry){
          assert.ok(row,'an explicit retry after a fresh runtime must reuse the committed request ID');
          assert.deepEqual(body,originalWrite,'a retry keeps the exact submitted analysis, comparison, reason and review condition');
          failDecisionReads=false;failReceiptLookup=false;recoverOnRetry=false;
        }
        if(!row){
          const symbol=securities.find(s=>s.id===body.p_security_id).symbol,metric=metrics(symbol);
          let scenario={assumptions:'other assets and FX fixed; no execution or cost',minus_ten_krw:metric.position.value*-.1,plus_ten_krw:metric.position.value*.1};
          if(body.p_target_pct!==null){
            assert.equal(body.p_security_id,securities[1].id);assert.equal(body.p_analysis_id,priorAnalysis.id);
            assert.equal(body.p_target_pct,comparison.target_pct);assert.equal(body.p_down_pct,comparison.price_assumptions.down_pct);assert.equal(body.p_up_pct,comparison.price_assumptions.up_pct);assert.equal(body.p_observation_at,now);
            const savedFields=['target_pct','price_assumptions','hold','reduce','exact_target','assets_before_krw','assets_after_before_cost_krw','observation_at','calculation_version'];
            scenario.choice_comparison=copy(project(comparison,savedFields));
          }else for(const key of ['p_analysis_id','p_down_pct','p_up_pct','p_observation_at'])assert.equal(body[key],null,'manual decisions do not inherit an unrelated comparison or analysis');
          row={id:'30000000-0000-4000-8000-'+String(decisions.length+1).padStart(12,'0'),security_id:body.p_security_id,request_id:body.p_request_id,choice:body.p_choice,reason:body.p_reason,review_condition:body.p_review_condition,analysis_id:body.p_analysis_id,created_at:new Date(Date.now()+decisions.length*1000).toISOString(),basis_at:now,thesis_version:1,scenario_snapshot:scenario,price_snapshot:{price_date:day,close:prices.find(p=>p.security_id===body.p_security_id).close,currency:'USD'},account_snapshot:{observation_at:now},official_evidence_snapshot:{}};
          decisions.unshift(row);
        }
        if(loseNextSave){loseNextSave=false;failReceiptLookup=true;return json(route,{message:'Synthetic committed write with lost response'},503)}
        return json(route,{ok:true,id:row.id});
      }
      if(!rpc.startsWith('get_')&&rpc!=='reconcile_live_cash_flows'){forbidden.push(rpc);return json(route,{message:'Unrequested writes are blocked'},403)}
      if(rpc==='get_investment_decisions')return failDecisionReads?json(route,{message:'Synthetic history read unavailable'},503):json(route,decisions.filter(d=>d.security_id===body.p_security_id).slice(0,10).map(d=>project(d,historyFields)));
      if(rpc==='get_live_decision_metrics')return json(route,metrics(body.p_symbol));
      if(rpc==='get_live_choice_comparison'){assert.equal(body.p_symbol,'MRNA');assert.equal(body.p_target_pct,8);assert.equal(body.p_down_pct,-12.5);assert.equal(body.p_up_pct,17.5);return json(route,comparison)}
      const security=securities.find(s=>s.id===body.p_security_id)||securities[0];
      const values={get_app_settings:{},reconcile_live_cash_flows:{ok:true},get_live_current_account_scope:scope,get_live_performance_summary:summary,get_live_reliable_performance:gate,
        get_live_home_chart:{items:snapshots.slice().reverse().map(s=>({date:s.snapshot_date,total_assets:s.total_assets}))},get_live_security_performance:{ok:true,items:[]},get_live_technical_summary:{ok:true,items:[]},get_live_monthly_performance:{ok:true,items:[]},
        get_live_security_detail:{ok:true,security,holding:{quantity:10},technical:{},prices:prices.filter(p=>p.security_id===security.id).slice().reverse().map(p=>({date:p.price_date,close:p.close,currency:p.currency}))},
        get_live_security_activity:{ok:true,items:[]},get_investment_thesis:{ok:true,thesis:{version:1,rationale:'실적 발표에서 보유 근거를 다시 확인',updated_at:now}},get_investment_breakout_rule:null,get_pending_kb_position_events:[]};
      return json(route,Object.hasOwn(values,rpc)?values[rpc]:{ok:false,items:[]});
    }
    if(method!=='GET'){forbidden.push(path);return json(route,{message:'Unrequested writes are blocked'},403)}
    const table=path.split('/').pop();
    if(table==='investment_decisions'&&failDecisionReads)return json(route,{message:'Synthetic decision reads unavailable'},503);
    if(table==='investment_decisions'&&url.searchParams.has('request_id')&&failReceiptLookup)return json(route,{message:'Synthetic receipt lookup unavailable'},503);
    const tables={accounts,securities,holdings,daily_account_snapshots:snapshots,live_holding_display_basis:basis,daily_security_prices:prices,investment_decisions:decisions,ai_analysis_history:[priorAnalysis]};
    let rows=tables[table]||[];
    for(const key of ['security_id','request_id','symbol']){const filter=url.searchParams.get(key);if(filter?.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===filter.slice(3))}
    const fields=url.searchParams.get('select');if(fields&&fields!=='*')rows=rows.map(row=>project(row,fields.split(',')));
    return json(route,rows);
  });
  const draftKey=id=>'portfolio_decision_draft_v1:'+encodeURIComponent(subject)+':'+encodeURIComponent(id);
  async function newVisit(){
    if(page)await page.close();
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>{dialogs.push(dialog.message());dialog.accept()});
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__decisionBrowser?.state().idle&&window.__decisionBrowser.state().loadEpoch>0);
    assert.equal(await page.locator('#login').isVisible(),false);
    assert.ok(await page.locator('#homeHoldings [data-security-id]').count());
  }
  async function openHolding(id){await page.locator('#homeHoldings [data-security-id="'+id+'"]').click();await page.locator('#detailDirectDecision').waitFor({state:'visible'})}
  async function openSaved(id){
    const reviews=page.locator('.home-reviews');if(!await reviews.evaluate(el=>el.open))await reviews.locator(':scope>summary').click();
    await reviews.locator('[data-decision-detail="'+id+'"]').click();await page.locator('#detailDecisionReview').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.__decisionBrowser.state().idle);
    await page.waitForFunction(()=>{const review=document.getElementById('detailDecisionReview'),rect=review?.getBoundingClientRect();return document.activeElement===review&&rect.top>=0&&rect.top<innerHeight-150},{},{timeout:5000});
  }
  async function waitForSavedFooter(){
    const action=page.locator('#detailNext[data-action="done"]:not([hidden])');
    await action.waitFor({state:'visible'});
    await page.locator('#detailDecisionDone').waitFor({state:'attached'});
    assert.equal(await action.isEnabled(),true,'the confirmed save exposes the existing footer completion action');
    assert.equal(await page.locator('#detailDecisionDone').isVisible(),false,'a real completed footer replaces the duplicate inline close control');
    assert.equal(await page.locator('#detailReturn').isVisible(),false,'the completed footer shows one close action');
    assert.equal(await page.locator('.detail-return-bar button:visible').count(),1);
  }
  async function assertSaved(row,withComparison){
    assert.equal(await page.locator('#detailDecisionForm').isVisible(),false,'a confirmed server record must not reopen as an unfinished draft');
    const lines=await page.locator('#detailDecisionSummary .sub').allTextContents();
    assert.ok(lines.includes('이유: '+row.reason),'the exact saved reason survives a fresh runtime');
    assert.ok(lines.includes('다시 볼 조건: '+row.review_condition),'the exact review condition survives a fresh runtime');
    if(withComparison){assert.match(lines.join('\n'),/목표 비중 8\.0% · 6주 매도 가정 · 주가 -12\.5% \/ \+17\.5% 가정/);assert.equal(await page.locator('#detailPreviousComparison').count(),1)}
    else{assert.ok(lines.includes('비교 없이 기록한 판단'));assert.equal(await page.locator('#detailPreviousComparison').count(),0)}
    assert.equal(await page.locator('#detailWeightTarget').inputValue(),'','saved assumptions are presented as history, not an active new draft');
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey(row.security_id)),null,'confirmed input is removed from the durable draft store');
    assert.equal(await page.locator('#detailNext').getAttribute('data-action'),'review','the next visit exposes the current review action, not stale completion styling');
    assert.equal(await page.locator('#detailReturn').isVisible(),true,'ordinary list navigation returns when reviewing a saved judgment');
  }
  async function calculateKnownComparison(){
    await page.locator('#detailChoiceGuide button').click();await page.locator('#detailWeightTarget').fill('8');
    if(!await page.locator('.choice-settings').evaluate(el=>el.open))await page.locator('.choice-settings>summary').click();
    await page.locator('#detailDown').fill('-12.5');await page.locator('#detailUp').fill('17.5');await page.locator('#detailWeightRun').click();
    await page.waitForFunction(()=>document.getElementById('detailComparisonNext')?.textContent==='이 의견으로 내 판단 남기기');
    await page.locator('#detailComparisonNext').click();
  }
  try{
    // Manual judgment: genuine DOM input -> production save -> RPC reread -> home -> new page.
    await newVisit();await openHolding(securities[0].id);await page.locator('#detailDirectDecision').click();
    const manualReason='매출과 이익이 함께 개선되는지 다음 실적에서 확인합니다.\n현금 흐름 < 목표여도 추가매수는 보류 & 현재 보유 유지.';
    const manualReview='다음 실적 발표에서 매출 성장과 영업 현금 흐름을 직접 확인';
    await page.locator('#detailReason').fill(manualReason);await page.locator('#detailReview').fill(manualReview);
    await page.locator('#detailDecisionForm button[type="submit"]').click();await waitForSavedFooter();
    assert.equal(writes.length,1);assert.equal(decisions[0].reason,manualReason);assert.equal(decisions[0].review_condition,manualReview);
    assert.equal(Object.hasOwn(decisions[0].scenario_snapshot,'choice_comparison'),false,'server baseline observations are not a user-selected comparison');const manual=copy(decisions[0]);
    await page.screenshot({path:resolve(output,name+'-manual-saved.png')});await page.locator('#detailNext[data-action="done"]').click();
    await newVisit();await openSaved(manual.security_id);await assertSaved(manual,false);assert.equal(writes.length,1);
    await page.screenshot({path:resolve(output,name+'-manual-reopened.png')});await page.locator('#detailReturn').click();

    // A matching, already stored synthetic AI opinion is read, never generated.
    await openHolding(securities[1].id);await page.locator('#detailDirectDecision').click();
    await page.locator('#detailChoice').selectOption('consider_reduction');await calculateKnownComparison();
    const compareReason='6주 매도 가정의 현금 확보와 가격 하락 영향을 확인하고 일부 축소를 검토';
    const compareReview='종가 95 달러 이하';
    await page.locator('#detailReason').fill(compareReason);await page.locator('#detailReview').fill(compareReview);
    await page.locator('#detailDecisionForm button[type="submit"]').click();await waitForSavedFooter();
    assert.equal(writes.length,2);const compared=copy(decisions[0]);assert.equal(compared.reason,compareReason);assert.equal(compared.review_condition,compareReview);assert.equal(compared.analysis_id,priorAnalysis.id);
    assert.equal(compared.scenario_snapshot.choice_comparison.reduce.shares_to_sell,6);
    await page.screenshot({path:resolve(output,name+'-comparison-saved.png')});
    await newVisit();await openSaved(compared.security_id);await assertSaved(compared,true);assert.equal(writes.length,2);
    await page.screenshot({path:resolve(output,name+'-comparison-reopened.png')});await page.locator('#detailReturn').click();

    // The server commits; both the write response and its recovery read are unavailable.
    // A new page must recognize that exact request as already saved, without another write.
    await openHolding(securities[2].id);await page.locator('#detailDirectDecision').click();
    await page.locator('#detailChoice').selectOption('revisit');
    await page.locator('#detailReason').fill('자료가 모자라 판단을 유보하고 다음 공시를 확인');
    await page.locator('#detailReview').fill('다음 공시에서 투자 전제를 직접 확인');
    loseNextSave=true;await page.locator('#detailDecisionForm button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('detailDecisionStatus')?.textContent.includes('판단 저장 실패'));
    assert.equal(writes.length,3);const recovered=copy(decisions[0]);
    assert.ok(await page.evaluate(key=>localStorage.getItem(key),draftKey(recovered.security_id)),'an uncertain response retains the durable draft');
    assert.equal(await page.locator('#detailDecisionDone').count(),0,'a failed verification cannot show a completed receipt');
    await page.screenshot({path:resolve(output,name+'-receipt-unavailable.png')});
    failReceiptLookup=false;await newVisit();await openSaved(recovered.security_id);await assertSaved(recovered,false);
    assert.equal(writes.length,3,'reopening a committed request never resubmits it');assert.equal(decisions.length,3);
    await page.screenshot({path:resolve(output,name+'-lost-receipt-reopened.png')});await page.locator('#detailReturn').click();

    // A comparison save also commits, but the next startup cannot read either home
    // or detail history. Retrying the unchanged restored input must retain all the
    // original payload, including its analysis and comparison, and create no new row.
    await page.locator('#homeHoldings [data-security-id="'+securities[1].id+'"]').click();
    await page.locator('[data-detail-jump="decision"]').click();await page.locator('#detailDecisionAction').click();
    await calculateKnownComparison();
    const retryReason='같은 6주 매도 가정으로 현금과 변동 폭을 재확인한 판단';
    const retryReview='종가 97 달러 이하';
    await page.locator('#detailReason').fill(retryReason);await page.locator('#detailReview').fill(retryReview);
    loseNextSave=true;await page.locator('#detailDecisionForm button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('detailDecisionStatus')?.textContent.includes('판단 저장 실패'));
    assert.equal(writes.length,4);assert.equal(decisions.length,4);const awaitingReceipt=copy(decisions[0]),originalPayload=copy(writes[3]);
    failDecisionReads=true;await newVisit();
    await page.locator('#homeHoldings [data-security-id="'+securities[1].id+'"]').click();
    await page.locator('#detailDecisionForm').waitFor({state:'visible'});
    assert.equal(await page.locator('#detailReason').inputValue(),retryReason);assert.equal(await page.locator('#detailReview').inputValue(),retryReview);
    assert.equal(await page.locator('#detailWeightTarget').inputValue(),'8');assert.equal(await page.locator('#detailDown').inputValue(),'-12.5');assert.equal(await page.locator('#detailUp').inputValue(),'17.5');
    assert.equal(writes.length,4,'history failures and startup never replay a save');
    const retryFooter=page.locator('#detailNext');
    await page.waitForFunction(()=>document.getElementById('detailNext')?.textContent==='이전 판단 저장 재시도',null,{timeout:5000});
    assert.equal(await retryFooter.isEnabled(),true,'the restored pending submission can be retried from the bottom action');
    await page.screenshot({path:resolve(output,name+'-comparison-retry-draft.png')});
    recoverOnRetry=true;await retryFooter.click();await waitForSavedFooter();
    assert.equal(writes.length,5);assert.deepEqual(writes[4],originalPayload);assert.equal(decisions.length,4,'explicit retry returns the same stored row');
    assert.equal(decisions[0].id,awaitingReceipt.id);assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey(awaitingReceipt.security_id)),null);
    await page.screenshot({path:resolve(output,name+'-comparison-retry-confirmed.png')});
    await newVisit();await openSaved(awaitingReceipt.security_id);await assertSaved(awaitingReceipt,true);assert.equal(writes.length,5);
    assert.deepEqual(forbidden,[],'no production mutation, model generation or external request is attempted');
    assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[],'finishing and reopening the reviewed paths does not require an unexpected leave confirmation');
    await page.screenshot({path:resolve(output,name+'-comparison-retry-reopened.png')});
    console.log('Build211 decisions '+name+': production startup/auth/submit/reread; exact manual and comparison content after new page; lost response + unavailable reads; original-payload retry without duplicate save passed ('+contract.file+')');
  }catch(error){
    await page?.screenshot({path:resolve(output,name+'-failure.png')}).catch(()=>{});
    const status=await page?.locator('#detailDecisionStatus').textContent().catch(()=>null);
    console.error(JSON.stringify({browser:name,contract:contract.file,historyFields,writes:writes.length,stored:decisions.length,status,forbidden,errors,dialogs}));throw error;
  }finally{await context.close();await browser.close()}
}
