import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {measureChartInput} from './chart_interaction238.mjs';

// Actual startup, stored-session authentication, API queue, resume events and renderers.
// Every browser request is fulfilled/aborted locally; all account values are synthetic.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(process.env.UI_SOURCE||resolve(root,'index.html'),'utf8');
const apiOrigin=source.match(/var SUPABASE_URL='([^']+)'/)[1];
const site='https://daily.portfolio.test/';
const output=resolve(root,process.env.UI_OUTPUT||'mobile-artifacts/detail-render234');
mkdirSync(output,{recursive:true});
const hook=`
  window.__dailyTest={
    refresh:function(){return refreshLive(true,false)},
    age:function(){lastLiveLoadAt=Date.now()-4*60*1000},
    state:function(){return {tab:currentTab,period:stockPeriod,query:stockPnlQuery,scope:stockPnlScope,
      resumePending:liveResumePending,renderPending:contentRenderPending,loadEpoch:liveLoadEpoch,
      idle:!liveRefreshPromise&&!liveLoadPromise&&!liveResumePromise&&!liveReadsActive&&!liveReadQueue.length,
      pnl:live&&live.stockPnl&&live.stockPnl.pnl_krw,error:liveError,deferred:!!(live&&live.detailsDeferred),enrichment:!!(live&&live.enrichmentLoading),background:!!backgroundSyncPromise}}
  };
`;
assert.ok(source.includes('  restoreLogin();'));
let measured=source.replace('      var d=results[0],activity=results[1];','      window.__detailRenderStart=performance.now();var d=results[0],activity=results[1];').replace('      renderDecisionHistory(results[3]);','      renderDecisionHistory(results[3]);window.__detailRenderMs=performance.now()-window.__detailRenderStart;');
const phases=[['html',"      body.innerHTML='<section class=\"card detail-price-chart\""],['chart','      bindSecurityChart(body,p,s.currency,detailChartSettings);'],['structure',"      var reasonSection=document.getElementById('detailThesisSummary')"],['reorder',"      body.prepend(body.querySelector('.detail-overview'),startPanel);"],['shortcuts',"      var shortcuts=document.createElement('nav');"],['controls',"      var editReason=document.createElement('button');"],['scrollReset',"      updateDetailStart(results[3]);"],['setup',"      document.getElementById('detailFreshReview').before"],['decisions','      renderDecisionHistory(results[3]);']];
for(const [name,anchor] of phases){assert.ok(measured.includes(anchor),name);measured=measured.replace(anchor,`      (window.__detailPhases||(window.__detailPhases={}))[${JSON.stringify(name)}]=performance.now();\n`+anchor)}
const profiled=measured.replace("if(!el.isConnected)return;el.textContent='';","if(!el.isConnected)return;window.__historyStart=performance.now();el.textContent='';").replace('el.appendChild(d)})})','el.appendChild(d)});window.__historyMs=performance.now()-window.__historyStart})');
const html=profiled.replace('  restoreLogin();',hook+'  restoreLogin();');
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const before=n=>new Date(Date.parse(day+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
const now=day+'T00:00:00Z';
const securities=[['ARM','ARM 검증 종목','USD'],['MRNA','MRNA 검증 종목','USD'],['MU','MU 검증 종목','USD'],['005930','국내 검증 종목','KRW']]
  .map(([symbol,name,currency],i)=>({id:'daily-'+i,symbol,name,currency,market:currency==='KRW'?'KRX':'NAS',country:currency==='KRW'?'KR':'US'}));
const accounts=[{id:'daily-account',name:'검증용 계좌',provider:'kb_securities',base_currency:'KRW',mode:'live',is_active:true}];
const holdings=securities.map((s,i)=>({account_id:accounts[0].id,security_id:s.id,quantity:10,as_of:now,currency:s.currency,market_value:1000000-i*100000,avg_cost:90000,market_price:100000,unrealized_pnl:100000,fx_rate_to_base:1}));
const basis=holdings.map(h=>({...h,valuation_krw:h.market_value,cost_krw:h.market_value-100000,pnl_krw:100000,rate_pct:10,average_unit_krw:(h.market_value-100000)/10,valued_unit_krw:h.market_value/10}));
const snapshots=Array.from({length:8},(_,i)=>({snapshot_date:before(i*3),snapshot_at:before(i*3)+'T00:00:00Z',total_assets:5400000-i*10000,cash:2000000,securities_value:3400000-i*10000,unrealized_pnl:400000,external_flow:0}));
const scope={ok:true,current_display_total:5400000,current_primary_value:5400000,current_isa_value:0,current_primary_observed_at:now,snapshot_at:now,broker_account_overlap_verified:true};
const prices=securities.flatMap((s,i)=>Array.from({length:365},(_,n)=>({security_id:s.id,price_date:before(n),observed_at:before(n)+'T00:00:00Z',close:120-i*10+10*Math.sin(n/10),currency:s.currency})));
const gate={ok:true,state:'estimated',partial:false,reliable_start:before(30),observed_through:day,investment_pnl:90000,return_estimate_pct:1.7,opening_assets:5310000,closing_assets:5400000,external_flow:0,as_of:now};
const summary={ok:true,return_ready:true,investment_pnl:90000,return_pct:1.7,period_start:before(30),period_end:day,realized_pnl:0,dividends_net:0};
function stockResult(period,generation){
  const items=securities.map((s,i)=>({...s,security_id:s.id,end_quantity:10,start_quantity:10,pnl_krw:i===3?null:[110000+generation*10000,-20000,0][i],reason:i===3?'가격 자료 확인 필요':null}));
  return {ok:true,period,period_start:period==='오늘'?day:before(30),period_end:day,basis_at:now,complete:false,all_items_displayed:true,candidate_count:4,source_candidate_count:4,krw_included_count:3,local_only_count:0,pnl_krw:items.slice(0,3).reduce((n,x)=>n+x.pnl_krw,0),items};
}
const savedAnalyses=Array.from({length:10},(_,i)=>({id:'analysis-'+i,symbol:'ARM',created_at:before(i)+'T00:00:00Z',thesis_version:1,response_kind:'model',question:'합성 보유 근거 점검 '+i,answer:'핵심 의견: 합성 자료를 이용한 테스트입니다.\n'+Array.from({length:50},(_,j)=>'근거 '+j+': 실제 투자 정보가 아닌 합성 문장입니다. 가격과 실적은 별도로 확인해야 합니다.').join('\n'),external_sources:[],official_evidence:null}));
const savedDecisions=Array.from({length:10},(_,i)=>({id:'decision-'+i,security_id:'daily-0',symbol:'ARM',choice:'hold',reason:'합성 보유 판단 '+i,review_condition:'실적 발표 후 다시 확인',created_at:before(i)+'T00:00:00Z',thesis_version:1,analysis_id:'analysis-'+i,scenario_snapshot:{}}));
function deferred(){let release,entered;const wait=new Promise(r=>{release=r}),hit=new Promise(r=>{entered=r});return {wait,hit,release,entered};}
async function waitGate(gate,label){let timer;try{await Promise.race([gate.hit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' request did not arrive')),15000)})])}finally{clearTimeout(timer)}}

const samples=[],verify=process.argv.includes('--verify'),trace=process.argv.includes('--trace'),repeat=process.argv.includes('--repeat'),pendingReturn=process.argv.includes('--pending-return'),lateHistory=process.argv.includes('--late-history'),chartInput=process.argv.includes('--chart-input');
assert.ok(!(pendingReturn&&lateHistory),'choose one gated scenario');
const heap=process.argv.includes('--heap');assert.ok(!heap||(repeat&&!verify&&!trace&&!pendingReturn&&!lateHistory&&!chartInput),'heap mode requires the bounded Chromium repeat scenario');
const repeatCount=Number(process.env.DETAIL_REPEATS||3);assert.ok([3,10].includes(repeatCount)||(heap&&repeatCount===30),'supported bounded repeat counts');
for(let run=0;run<(verify?(process.env.CHROMIUM_ONLY?1:2):5);run++){
 const name=verify&&run===1?'webkit':'chromium',engine=name==='webkit'?webkit:chromium;
  scope.current_display_total=5400000; // Each browser starts with its own baseline value.
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:'daily-browser-'+name,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await context.addInitScript(({token,key})=>localStorage.setItem(key,JSON.stringify({accessToken:token,refreshToken:'synthetic-local-refresh',expiresAt:Date.now()+3600000})),{token:jwt,key:'my_portfolio_session_v2'});
  const calls=[],forbidden=[],errors=[];let historyGate=null,reviewGate=null,decisionReads=0,detailGate=null,generation=0,coreDelay=null,pnlDelay=null,failCore=false,extraDelay=null,backgroundDelay=deferred(),failExtra=false;
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
    assert.equal(request.headers().authorization,'Bearer '+jwt,'real authFetch supplies the isolated stored-session token');
    calls.push({path,body,...((pendingReturn||lateHistory)?{query:url.searchParams.toString()}: {})});await new Promise(r=>setTimeout(r,50));
    if(path.startsWith('/functions/')){
      if(body.action==='sync-current')return json(route,{ok:true});
      if(body.action==='sync-history-month'||body.action==='sync-prices'){await backgroundDelay.wait;return json(route,{ok:true})}

      if(body.action==='overseas-day-pnl')return json(route,{ok:true,available:false,items:[]});
      if(body.action==='sync-target-prices'&&body.security_ids?.every(id=>securities.some(s=>s.id===id)))return json(route,{ok:true,results:[]});
      forbidden.push(path+':'+String(body.action||''));return json(route,{message:'Live writes and model calls are blocked'},403);
    }
    if(path.startsWith('/rest/v1/rpc/')){
      const rpc=path.split('/').pop();
      if(rpc==='get_live_security_detail'&&body.p_security_id==='daily-0'&&detailGate){detailGate.entered();await detailGate.wait;}
      if(lateHistory&&rpc==='get_investment_decisions'&&body.p_security_id==='daily-0'){decisionReads++;if(decisionReads===2&&reviewGate){reviewGate.entered();await reviewGate.wait;}}
      if(!rpc.startsWith('get_')&&rpc!=='reconcile_live_cash_flows'){forbidden.push(rpc);return json(route,{message:'Writes are blocked'},403)}
      if(rpc==='get_live_period_stock_pnl'){if(pnlDelay){const pending=pnlDelay;pending.entered();await pending.wait}return json(route,stockResult(body.p_period,generation))}
      if(rpc==='get_live_benchmark_comparison'&&extraDelay){extraDelay.entered();await extraDelay.wait}
      const security=securities.find(s=>s.id===body.p_security_id)||securities[0];
      const values={get_wealth_dashboard:{ok:true,plan:{base_amount:5000000,base_date:day,std_rate:20,best_rate:30,revision:0},current:{amount:5400000,as_of:day},records:[]},get_app_settings:{},reconcile_live_cash_flows:{ok:true},get_live_current_account_scope:scope,
        get_live_performance_summary:summary,get_live_reliable_performance:gate,
        get_live_home_chart:{items:snapshots.slice().reverse().map(s=>({date:s.snapshot_date,total_assets:s.total_assets}))},
        get_live_security_performance:{ok:true,items:[]},get_live_technical_summary:{ok:true,items:[]},get_live_monthly_performance:{ok:true,items:[]},
        get_live_security_detail:{ok:true,security,holding:{quantity:10},technical:{},prices:prices.filter(p=>p.security_id===security.id).slice().reverse().map(p=>({date:p.price_date,close:p.close,currency:p.currency}))},
        get_live_security_activity:{ok:true,items:[]},get_investment_thesis:{ok:true,thesis:{version:1,rationale:'실적 발표에서 보유 근거를 다시 확인',updated_at:now}},
        get_investment_decisions:pendingReturn?savedDecisions.filter(d=>d.security_id===security.id):savedDecisions,get_investment_breakout_rule:null,get_live_realized_sales:{ok:true,items:[],period:body.p_period},get_pending_kb_position_events:[]};
      return json(route,Object.hasOwn(values,rpc)?values[rpc]:{ok:false,items:[]});
    }
    if(method!=='GET'){forbidden.push(path);return json(route,{message:'Writes are blocked'},403)}
    const table=path.split('/').pop();
    if(table==='ai_analysis_history'&&historyGate){historyGate.entered();await historyGate.wait;}
    if(table==='holdings'&&coreDelay){const pending=coreDelay;pending.entered();await pending.wait}
    if(table==='holdings'&&failCore)return json(route,{message:'synthetic offline'},503);
    if(table==='transactions'&&failExtra)return json(route,{message:'synthetic extra failure'},503);
    const tables={accounts,securities,holdings,daily_account_snapshots:snapshots,live_holding_display_basis:basis,daily_security_prices:prices,investment_decisions:[],ai_analysis_history:savedAnalyses};
    if(pendingReturn&&table==='ai_analysis_history'&&url.searchParams.get('symbol')==='eq.MRNA')return json(route,[]);
    if(table==='ai_analysis_history'&&url.searchParams.get('select')==='id,created_at,official_evidence')return json(route,savedAnalyses.map(({id,created_at,official_evidence})=>({id,created_at,official_evidence})));
    return json(route,tables[table]||[]);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  if(name==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  try{
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__dailyTest?.state().idle&&window.__dailyTest.state().loadEpoch>0);
    await page.locator('#nav [data-tab="portfolio"]').click();
    await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().deferred);
    if(chartInput){
      const attempts=[];
      for(let visit=0;visit<(verify?6:1);visit++){
        if(verify){await page.setViewportSize({width:[390,402,430][visit%3],height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,visit<3?'1':'1.25');}
        await page.locator('.portfolio-list [data-security-id="daily-0"]').click();
        await page.waitForFunction(()=>window.__dailyTest.state().idle&&document.querySelectorAll('#thesisPrevious .ai-history-item').length===10);
        calls.length=0;const result=await measureChartInput(page);assert.equal(calls.length,0,'chart input makes no requests');
        assert.ok(await page.locator('.detail-sheet').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'detail fits');
        attempts.push({...result,requests:calls.length});
        if(visit%2)await page.goBack();else await page.locator('#detailClose').click();
        await page.locator('#detailModal').waitFor({state:'hidden'});
      }
      samples.push({run:run+1,engine:name,attempts});assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);continue;
    }
    if(lateHistory){
      const attempts=[],cdp=name==='chromium'?await context.newCDPSession(page):null;
      if(cdp)await cdp.send('Performance.enable');
      const chartSnapshot=()=>page.evaluate(()=>{const r=document.querySelector('.security-price-interactive');return {date:r.querySelector('[data-price-date]').textContent,start:r.dataset.chartStart,count:r.dataset.chartCount,period:r.querySelector('[data-chart-period][aria-pressed="true"]')?.dataset.chartPeriod,selected:r.querySelector('.security-chart-hit').getAttribute('aria-valuenow')}});
      for(let visit=0;visit<(verify?6:1);visit++){
        if(verify){await page.setViewportSize({width:[390,402,430][visit%3],height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,visit<3?'1':'1.25');}
        calls.length=0;decisionReads=0;historyGate=deferred();reviewGate=deferred();
        await page.evaluate(()=>{window.__lateStart=performance.now();document.querySelector('.portfolio-list [data-security-id="daily-0"]').click()});
        await page.locator('#detailOverview').waitFor();await waitGate(historyGate,'saved history');
        const readyMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__lateStart)))));
        const period=page.locator('[data-chart-period="3"]');await period.scrollIntoViewIfNeeded();
        await page.evaluate(()=>window.__inputStart=performance.now());await period.tap();
        const periodCallbackMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__inputStart)))));
        await page.locator('.security-chart-hit').press('Home');
        const selected=await chartSnapshot();assert.equal(selected.period,'3');
        await page.evaluate(()=>{window.__lateChart=document.querySelector('.security-price-interactive');window.__lateHistoryTasks=[];window.__lateObserver=new PerformanceObserver(l=>window.__lateHistoryTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));try{window.__lateObserver.observe({type:'longtask'})}catch(e){}});
        const beforeMetrics=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
        const releaseStart=await page.evaluate(()=>performance.now());historyGate.release();historyGate=null;
        await waitGate(reviewGate,'decision review');
        await page.waitForFunction(()=>document.querySelectorAll('#thesisPrevious .ai-history-item').length===10);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const historyReadyMs=await page.evaluate(start=>performance.now()-start,releaseStart);
        const historyMetrics=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
        const historyEnd=await page.evaluate(()=>performance.now());
        assert.deepEqual(await chartSnapshot(),selected,'history preserves chart period and point');
        assert.ok(await page.evaluate(()=>window.__lateChart===document.querySelector('.security-price-interactive')),'history keeps chart DOM');
        const editorSteps=[];
        async function editorStep(label,action){
          const before=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
          const start=await page.evaluate(()=>performance.now());await action();
          const end=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now())))));
          const after=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
          editorSteps.push({label,callbackMs:end-start,cpu:cdp?Object.fromEntries(['LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','LayoutCount'].map(k=>[k,after.find(m=>m.name===k).value-before.find(m=>m.name===k).value])):null,
            longTasks:name==='chromium'?await page.evaluate(({start,end})=>window.__lateHistoryTasks.filter(t=>t.start>=start&&t.start<end).map(t=>t.duration),{start,end}):null});
        }
        await editorStep('revealSavedReview',async()=>{await page.locator('#detailStartAction').click();await page.locator('#detailDecisionReview').waitFor({state:'visible'})});
        await editorStep('openEditor',()=>page.locator('#detailDecisionAction').click());
        await editorStep('fillReason',()=>page.locator('#detailReason').fill('합성 작성 중 초안 '+visit));
        await editorStep('fillReview',()=>page.locator('#detailReview').fill('합성 실적 확인 조건 '+visit));
        await page.locator('#detailReason').focus();
        await page.locator('#detailReason').evaluate(e=>e.setSelectionRange(2,7));
        const draft=await page.evaluate(()=>{const e=document.querySelector('#detailReason');return {reason:e.value,review:document.querySelector('#detailReview').value,focus:document.activeElement.id,start:e.selectionStart,end:e.selectionEnd}});
        const reviewMetrics=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
        const reviewStart=await page.evaluate(()=>performance.now());reviewGate.release();reviewGate=null;
        await page.waitForFunction(()=>window.__dailyTest.state().idle);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const reviewReadyMs=await page.evaluate(start=>performance.now()-start,reviewStart);
        assert.deepEqual(await page.evaluate(()=>{const e=document.querySelector('#detailReason');return {reason:e.value,review:document.querySelector('#detailReview').value,focus:document.activeElement.id,start:e.selectionStart,end:e.selectionEnd}}),draft,'late decision reread preserves draft, focus and selection');
        assert.deepEqual(await chartSnapshot(),selected,'decision reread preserves chart');
        assert.ok(await page.evaluate(()=>window.__lateChart===document.querySelector('.security-price-interactive')),'decision reread keeps chart DOM');
        assert.ok(await page.locator('.detail-sheet').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'sheet has no horizontal overflow');
        assert.ok(await page.locator('#detailOverview strong').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'amounts fit');
        assert.equal(await page.locator('#detailDecisionForm').isVisible(),true);
        const afterMetrics=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
        const cpu=cdp?Object.fromEntries(['LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','LayoutCount'].map(k=>[k,afterMetrics.find(m=>m.name===k).value-beforeMetrics.find(m=>m.name===k).value])):null;
        const phaseCpu=cdp?Object.fromEntries([['history',beforeMetrics,historyMetrics],['editor',historyMetrics,reviewMetrics],['review',reviewMetrics,afterMetrics]].map(([phase,a,b])=>[phase,Object.fromEntries(['LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','LayoutCount'].map(k=>[k,b.find(m=>m.name===k).value-a.find(m=>m.name===k).value]))])):null;
        const longTasks=name==='chromium'?await page.evaluate(()=>{window.__lateObserver.disconnect();return window.__lateHistoryTasks}):null;
        const phaseLongTasks=longTasks?Object.fromEntries([['history',releaseStart,historyEnd],['editor',historyEnd,reviewStart],['review',reviewStart,Infinity]].map(([phase,a,b])=>[phase,longTasks.filter(t=>t.start>=a&&t.start<b).map(t=>t.duration)])):null;
        assert.equal(calls.filter(c=>c.path.endsWith('/ai_analysis_history')).length,1,'one shared history request');
        assert.equal(decisionReads,2,'initial and fresh decision reads');
        attempts.push({readyMs,periodCallbackMs,historyReadyMs,reviewReadyMs,selected,editorSteps,cpu,phaseCpu,longTasks,phaseLongTasks,requests:calls.length,requestNames:calls.map(c=>c.path.split('/').pop())});
        if(verify&&visit%2)await page.goBack();else await page.locator('#detailClose').click();
        await page.locator('#detailModal').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>document.activeElement?.dataset.securityId),'daily-0');
      }
      samples.push({run:run+1,engine:name,attempts});assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);continue;
    }
    if(pendingReturn){
      const attempts=[];
      for(let visit=0;visit<(verify?6:1);visit++){
        if(verify){await page.setViewportSize({width:[390,402,430][visit%3],height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,visit<3?'1':'1.25');}
        calls.length=0;detailGate=deferred();
        const row=page.locator('.portfolio-list [data-security-id="daily-0"]');await row.scrollIntoViewIfNeeded();
        const before=await page.evaluate(()=>scrollY);
        await row.click();await waitGate(detailGate,'ARM detail');
        await page.evaluate(()=>window.__closeStart=performance.now());
        if(verify&&visit%2)await page.goBack();else await page.locator('#detailReturn').click();
        await page.locator('#detailModal').waitFor({state:'hidden'});
        const closeMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__closeStart)))));
        assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<=2,'pending return preserves scroll');
        assert.equal(await page.evaluate(()=>document.activeElement?.dataset.securityId),'daily-0');
        await page.evaluate(()=>{window.__otherStart=performance.now();document.querySelector('.portfolio-list [data-security-id="daily-1"]').click()});
        await page.locator('#detailOverview').waitFor();
        const otherReadyMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__otherStart)))));
        assert.match(await page.locator('#detailBody').innerText(),/MRNA/);
        const oldReadsBeforeRelease=calls.filter(c=>c.body.p_security_id==='daily-0').map(c=>c.path.split('/').pop());
        const hit=page.locator('.security-chart-hit');await hit.scrollIntoViewIfNeeded();
        await page.evaluate(()=>window.__chartInputStart=performance.now());await hit.tap();
        const chartCallbackMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__chartInputStart)))));
        await hit.press('Home');
        const chartState=await page.evaluate(()=>{const root=document.querySelector('.security-price-interactive');window.__pendingChart=root;return {date:root.querySelector('[data-price-date]').textContent,start:root.dataset.chartStart,count:root.dataset.chartCount}});
        detailGate.release();detailGate=null;
        await page.waitForFunction(()=>window.__dailyTest.state().idle);
        assert.match(await page.locator('#detailBody').innerText(),/MRNA/);
        assert.equal(await page.locator('#detailBody .detail-overview').count(),1);
        assert.ok(await page.locator('.detail-sheet').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        assert.deepEqual(await page.evaluate(()=>{const root=document.querySelector('.security-price-interactive');if(root!==window.__pendingChart)throw Error('late old detail recreated active chart');return {date:root.querySelector('[data-price-date]').textContent,start:root.dataset.chartStart,count:root.dataset.chartCount}}),chartState);
        assert.ok(!calls.some(c=>c.path.endsWith('/ai_analysis_history')&&new URLSearchParams(c.query).get('symbol')==='eq.ARM'),'closed ARM detail launches no history read');
        const requestNames=calls.map(c=>({name:c.path.split('/').pop(),security:c.body.p_security_id||null,query:c.query}));
        assert.equal(calls.filter(c=>c.body.p_security_id==='daily-0').length,oldReadsBeforeRelease.length,'stale core response starts no additional security RPC');
        attempts.push({closeMs,otherReadyMs,chartCallbackMs,chartState,oldReadsBeforeRelease,requestNames});
        await page.locator('#detailReturn').click();await page.locator('#detailModal').waitFor({state:'hidden'});
      }
      samples.push({run:run+1,engine:name,attempts});assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);continue;
    }
    const cdp=name==='chromium'?await context.newCDPSession(page):null,entries=[];
    if(cdp)await cdp.send('Performance.enable');
    for(let visit=0;visit<(verify?6:repeat?repeatCount:1);visit++){
      const metricsBefore=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
      await page.evaluate(()=>{window.__longTasks=[];window.__longObserver=new PerformanceObserver(l=>window.__longTasks.push(...l.getEntries().map(e=>e.duration)));try{window.__longObserver.observe({type:'longtask'})}catch(e){}});
      if(verify){await page.setViewportSize({width:[390,402,430][visit%3],height:844});await page.evaluate(zoom=>document.documentElement.style.zoom=zoom,visit<3?'1':'1.25');}
      const traceEvents=[];
      const collectTrace=event=>traceEvents.push(...event.value);
      if(trace&&cdp){cdp.on('Tracing.dataCollected',collectTrace);await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.stack',transferMode:'ReportEvents'});}
      calls.length=0;
      await page.evaluate(()=>{window.__start=performance.now();document.querySelector('.portfolio-list [data-security-id="daily-0"]').click()});
      await page.locator('#detailOverview').waitFor();
      const readyMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));
      await page.waitForFunction(()=>window.__dailyTest.state().idle);
      await page.waitForFunction(()=>document.querySelectorAll('#thesisPrevious .ai-history-item').length===10);
      const metricsAfter=cdp?(await cdp.send('Performance.getMetrics')).metrics:[];
      let timeline;
      if(trace&&cdp){
        const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await done;cdp.off('Tracing.dataCollected',collectTrace);
        timeline=traceEvents.filter(e=>['Layout','UpdateLayoutTree','FunctionCall'].includes(e.name)&&e.dur).map(e=>({name:e.name,durationMs:e.dur/1000,args:e.args}));
      }
      const cpu=Object.fromEntries(['LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','LayoutCount'].map(k=>[k,(metricsAfter.find(m=>m.name===k)?.value||0)-(metricsBefore.find(m=>m.name===k)?.value||0)]));
      const longTasks=await page.evaluate(()=>{window.__longObserver.disconnect();return window.__longTasks});
      if(verify){
        assert.ok(await page.locator('.detail-sheet').evaluate(e=>e.scrollTop<2),'each entry starts at top, including after a scrolled prior detail');
        assert.ok(await page.locator('.detail-sheet').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal overflow');
        assert.ok(await page.locator('#detailOverview strong').evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth+1)),'overview amounts fit');
      }
      const history=await page.evaluate(()=>({phases:window.__detailPhases,phaseStart:window.__detailRenderStart,historyMs:Math.round(window.__historyMs),historyNodes:document.querySelector('#thesisPrevious').querySelectorAll('*').length}));
      await page.evaluate(()=>{let el=document.querySelector('#thesisPrevious');for(;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.evaluate(()=>{const item=document.querySelector('#thesisPrevious .ai-history-item');window.__openStart=performance.now();item.open=true;});
      const openMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__openStart)))));
      await page.waitForFunction(()=>document.querySelector('#thesisPrevious .ai-history-body').textContent.includes('근거 49'));
      const openedNodes=await page.locator('#thesisPrevious *').count();
      const renderMs=await page.evaluate(()=>Math.round(window.__detailRenderMs));
      const requestNames=calls.map(c=>c.path.split('/').pop());
      await page.locator('.detail-sheet').evaluate(e=>e.scrollTop=e.scrollHeight);
      if(verify&&visit%2)await page.goBack();else await page.locator('#detailReturn').click();await page.locator('#detailModal').waitFor({state:'hidden'});
      if(cdp)await cdp.send('HeapProfiler.collectGarbage');
      const heapAfterReturn=heap?await cdp.send('Runtime.getHeapUsage'):null;
      if(heap)assert.ok(Number.isFinite(heapAfterReturn.usedSize)&&heapAfterReturn.usedSize>0,'heap bytes returned by CDP');
      entries.push({...(heap?{heapAfterReturn}:{}),visit:visit+1,readyMs:Math.round(readyMs),renderMs,cpu,longTasks,...(timeline?{timeline}:{}),...history,openMs:Math.round(openMs),openedNodes,requests:calls.length,requestNames,...(cdp?await cdp.send('Memory.getDOMCounters'):{})});
    }
    if(verify){
      assert.equal(entries[0].requestNames.filter(n=>n==='ai_analysis_history').length,1);
      assert.equal(entries[0].requestNames.filter(n=>n==='get_investment_decisions').length,2,'decisions still reread after official evidence');
      savedAnalyses[0].question='합성 변경 확인 '+name;
      calls.length=0;
      await page.locator('.portfolio-list [data-security-id="daily-0"]').click();
      await page.waitForFunction(expected=>document.querySelector('#thesisPrevious .ai-history-item summary')?.textContent.includes(expected),'합성 변경 확인 '+name);
      await page.waitForFunction(()=>window.__dailyTest.state().idle);
      assert.equal(calls.filter(c=>c.path.endsWith('/ai_analysis_history')).length,1,'reopening reads fresh history once');
      await page.locator('#detailReturn').click();await page.locator('#detailModal').waitFor({state:'hidden'});
      console.log(name+': saved decision refresh shares in-flight history; reopening reads changed data');
    }
    if(repeat){
      for(const entry of entries){
        assert.equal(entry.requests,8,'every entry performs fresh detail reads');
        assert.equal(entry.requestNames.filter(n=>n==='ai_analysis_history').length,1);
        for(const key of ['documents','nodes','jsEventListeners'])assert.equal(entry[key],entries[0][key],'bounded retained DOM count: '+key);
      }
    }
    samples.push({run:run+1,entries});assert.deepEqual(errors,[]);
  }finally{if(historyGate)historyGate.release();if(reviewGate)reviewGate.release();if(detailGate)detailGate.release();if(extraDelay)extraDelay.release();backgroundDelay.release();await context.close();await browser.close()}
}
console.log(JSON.stringify({heapMeasurement:heap?'Runtime.getHeapUsage bytes after forced GC on each return; same V8 isolate, includes test instrumentation; not process RSS, peaks, native iOS memory or timers':null,scenario:chartInput?'full detail chart controls and 240 synthetic crosshair pointer samples':lateHistory?'gate shared history then decision reread; retain chart period/point and draft focus/selection':pendingReturn?'close gated ARM core response, open MRNA, touch/keyboard chart, release ARM and preserve active chart':'detail rendering',conditions:chartInput?'5 fresh Chromium sessions (verification: six width/zoom cases each engine); full app idle detail,365 prices,10 saved decisions/histories;390x844 CPU4x;50ms mocked reads,SW blocked;controls plus60 frames x4 same-day pointer samples;callback is not paint/INP or physical iPhone latency':lateHistory?((verify?'Chromium/WebKit six width/zoom cases':'5 fresh Chromium sessions at 390x844')+'; warmed portfolio,365 prices,10 saved decisions,10 long AI histories; synthetic 50ms API reads plus controlled gates; Chromium CPU4x/WebKit default; SW blocked; callback/readiness includes automation and two rAF; aggregate CPU/longtasks cover both late phases AND intervening editor input; phaseCpu separates history/editor/review including automation assertions; phaseLongTasks grouped by task start; no heap/byte measurement'):pendingReturn?(verify?'Each engine: six width/zoom pending-return cases; synthetic 365-point prices; ARM saved history; MRNA without saved decisions; synthetic 50ms API reads, gated ARM detail; Chromium CPU4x, WebKit default; SW blocked; emulated tap and keyboard input; no GC or heap measurement':'5 fresh Chromium sessions; one pending-return case per session; 390x844 touch/mobile CPU4x; synthetic 365-point prices; ARM saved history; MRNA without saved decisions; synthetic 50ms API reads, gated ARM detail; SW blocked; emulated tap and keyboard input; no GC or heap measurement'):(verify?'Browser verification; ':'Timing baseline; ')+(verify?'each engine: six width/zoom entries plus fresh reopen; ':(repeat?'5 fresh Chromium sessions x'+repeatCount+' same-detail entries; ':'5 fresh Chromium sessions x1 detail entry; '))+ ' 365 prices, 10 saved decisions, 10 long AI histories; 390x844 CPU4x; synthetic 50ms API responses; actual login/render/request queue; SW blocked; readiness includes two rAF callbacks, not actual presented paint; forced GC after return',samples},null,2));
