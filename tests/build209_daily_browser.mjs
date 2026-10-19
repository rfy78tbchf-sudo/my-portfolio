import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

// Actual startup, stored-session authentication, API queue, resume events and renderers.
// Every browser request is fulfilled/aborted locally; all account values are synthetic.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'index.html'),'utf8');
const apiOrigin=source.match(/var SUPABASE_URL='([^']+)'/)[1];
const site='https://daily.portfolio.test/';
const output=resolve(root,process.env.UI_OUTPUT||'mobile-artifacts/build209-daily');
mkdirSync(output,{recursive:true});
const hook=`
  window.__dailyTest={
    age:function(){lastLiveLoadAt=Date.now()-4*60*1000},
    state:function(){return {tab:currentTab,period:stockPeriod,query:stockPnlQuery,scope:stockPnlScope,
      resumePending:liveResumePending,renderPending:contentRenderPending,loadEpoch:liveLoadEpoch,
      idle:!liveRefreshPromise&&!liveLoadPromise&&!liveResumePromise&&!liveReadsActive&&!liveReadQueue.length,
      pnl:live&&live.stockPnl&&live.stockPnl.pnl_krw,error:liveError}}
  };
`;
assert.ok(source.includes('  restoreLogin();'));
const html=source.replace('  restoreLogin();',hook+'  restoreLogin();');
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
const prices=securities.flatMap((s,i)=>Array.from({length:24},(_,n)=>({security_id:s.id,price_date:before(n),observed_at:before(n)+'T00:00:00Z',close:120-i*10-n,currency:s.currency})));
const gate={ok:true,state:'estimated',partial:false,reliable_start:before(30),observed_through:day,investment_pnl:90000,return_estimate_pct:1.7,opening_assets:5310000,closing_assets:5400000,external_flow:0,as_of:now};
const summary={ok:true,return_ready:true,investment_pnl:90000,return_pct:1.7,period_start:before(30),period_end:day,realized_pnl:0,dividends_net:0};
function stockResult(period,generation){
  const items=securities.map((s,i)=>({...s,security_id:s.id,end_quantity:10,start_quantity:10,pnl_krw:i===3?null:[110000+generation*10000,-20000,0][i],reason:i===3?'가격 자료 확인 필요':null}));
  return {ok:true,period,period_start:period==='오늘'?day:before(30),period_end:day,basis_at:now,complete:false,all_items_displayed:true,candidate_count:4,source_candidate_count:4,krw_included_count:3,local_only_count:0,pnl_krw:items.slice(0,3).reduce((n,x)=>n+x.pnl_krw,0),items};
}
function deferred(){let release,entered;const wait=new Promise(r=>{release=r}),hit=new Promise(r=>{entered=r});return {wait,hit,release,entered};}
async function waitGate(gate,label){let timer;try{await Promise.race([gate.hit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' request did not arrive')),15000)})])}finally{clearTimeout(timer)}}

for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:'daily-browser-'+name,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await context.addInitScript(({token,key})=>localStorage.setItem(key,JSON.stringify({accessToken:token,refreshToken:'synthetic-local-refresh',expiresAt:Date.now()+3600000})),{token:jwt,key:'my_portfolio_session_v2'});
  const calls=[],forbidden=[],errors=[];let generation=0,coreDelay=null,pnlDelay=null;
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
    calls.push({path,body});
    if(path.startsWith('/functions/')){
      if(body.action==='overseas-day-pnl')return json(route,{ok:true,available:false,items:[]});
      if(body.action==='sync-target-prices'&&body.security_ids?.every(id=>securities.some(s=>s.id===id)))return json(route,{ok:true,results:[]});
      forbidden.push(path+':'+String(body.action||''));return json(route,{message:'Live writes and model calls are blocked'},403);
    }
    if(path.startsWith('/rest/v1/rpc/')){
      const rpc=path.split('/').pop();
      if(!rpc.startsWith('get_')&&rpc!=='reconcile_live_cash_flows'){forbidden.push(rpc);return json(route,{message:'Writes are blocked'},403)}
      if(rpc==='get_live_period_stock_pnl'){if(pnlDelay){const pending=pnlDelay;pending.entered();await pending.wait}return json(route,stockResult(body.p_period,generation))}
      const security=securities.find(s=>s.id===body.p_security_id)||securities[0];
      const values={get_app_settings:{},reconcile_live_cash_flows:{ok:true},get_live_current_account_scope:scope,
        get_live_performance_summary:summary,get_live_reliable_performance:gate,
        get_live_home_chart:{items:snapshots.slice().reverse().map(s=>({date:s.snapshot_date,total_assets:s.total_assets}))},
        get_live_security_performance:{ok:true,items:[]},get_live_technical_summary:{ok:true,items:[]},get_live_monthly_performance:{ok:true,items:[]},
        get_live_security_detail:{ok:true,security,holding:{quantity:10},technical:{},prices:prices.filter(p=>p.security_id===security.id).slice().reverse().map(p=>({date:p.price_date,close:p.close,currency:p.currency}))},
        get_live_security_activity:{ok:true,items:[]},get_investment_thesis:{ok:true,thesis:{version:1,rationale:'실적 발표에서 보유 근거를 다시 확인',updated_at:now}},
        get_investment_decisions:[],get_investment_breakout_rule:null,get_live_realized_sales:{ok:true,items:[],period:body.p_period},get_pending_kb_position_events:[]};
      return json(route,Object.hasOwn(values,rpc)?values[rpc]:{ok:false,items:[]});
    }
    if(method!=='GET'){forbidden.push(path);return json(route,{message:'Writes are blocked'},403)}
    const table=path.split('/').pop();
    if(table==='accounts'&&coreDelay){const pending=coreDelay;pending.entered();await pending.wait}
    const tables={accounts,securities,holdings,daily_account_snapshots:snapshots,live_holding_display_basis:basis,daily_security_prices:prices,investment_decisions:[],ai_analysis_history:[]};
    return json(route,tables[table]||[]);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__dailyTest?.state().idle&&window.__dailyTest.state().loadEpoch>0);
    assert.equal(await page.locator('#login').isVisible(),false,'stored session reaches the real home without a login prompt');
    assert.ok(await page.locator('#homeHoldings [data-security-id]').count());
    assert.ok(await page.locator('#homeTrend svg').count(),'real home chart renders from mocked REST data');
    await page.screenshot({path:resolve(output,name+'-home.png')});
    await page.locator('#nav [data-tab="portfolio"]').click();
    assert.ok(await page.locator('.portfolio-list [data-security-id]').count());
    await page.locator('#nav [data-tab="performance"]').click();
    await page.locator('#stockPnlSearch').waitFor();
    await page.locator('[data-stock-period="THIS_MONTH"]').click();
    await page.waitForFunction(()=>window.__dailyTest.state().idle&&window.__dailyTest.state().period==='THIS_MONTH');
    await page.locator('[data-pnl-scope="foreign"]').click();
    assert.match(await page.locator('.performance-hero').innerText(),/일부 계산/);
    const originalPnl=await page.locator('.performance-hero .asset').innerText();
    const initialLoads=calls.filter(c=>c.path==='/rest/v1/accounts').length;

    // The user starts typing after resume has already begun, before core data returns.
    generation=1;coreDelay=deferred();
    await page.evaluate(()=>{window.__dailyTest.age();window.dispatchEvent(new Event('pageshow'))});
    await waitGate(coreDelay,'core resume');
    await page.locator('#stockPnlSearch').fill('ARM');
    await page.evaluate(()=>{window.__dailyInputNode=document.activeElement});
    const listY=await page.evaluate(()=>scrollY);
    coreDelay.release();coreDelay=null;
    await page.waitForFunction(()=>window.__dailyTest.state().idle&&window.__dailyTest.state().renderPending);
    assert.equal(await page.evaluate(()=>document.activeElement===window.__dailyInputNode),true,'background completion keeps the exact focused input node');
    assert.equal(await page.locator('#stockPnlSearch').inputValue(),'ARM');
    assert.equal(await page.locator('.performance-hero .asset').innerText(),originalPnl);
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-listY)<3);
    await page.screenshot({path:resolve(output,name+'-typing-preserved.png')});

    // Blur releases the postponed render; keep the prior partial result while recalculating.
    pnlDelay=deferred();
    await page.evaluate(()=>document.activeElement.blur());
    await waitGate(pnlDelay,'deferred performance');
    assert.match(await page.locator('#content').innerText(),/이전 조회 · 최신 손익 확인 중/);
    assert.match(await page.locator('.performance-hero').innerText(),/일부 계산/);
    assert.equal(await page.locator('.performance-hero .asset').innerText(),originalPnl);
    pnlDelay.release();pnlDelay=null;
    await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().renderPending&&window.__dailyTest.state().pnl===100000);
    assert.equal(await page.locator('#stockPnlSearch').inputValue(),'ARM');
    assert.equal(await page.locator('[data-pnl-scope="foreign"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-stock-period="THIS_MONTH"]').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('.performance-hero').innerText(),/일부 계산/);
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-listY)<3,'period, filtered list and scroll survive the completed resume');
    assert.equal(calls.filter(c=>c.path==='/rest/v1/accounts').length,initialLoads+1);
    await page.screenshot({path:resolve(output,name+'-performance-resumed.png')});

    await page.locator('[data-performance-detail="ARM"]').click();
    await page.locator('#detailDirectDecision').click();
    await page.locator('#detailReason').fill('실적 발표까지 유지하는 검증용 초안');
    await page.locator('#detailReview').fill('다음 실적 발표에서 매출 확인');
    const beforeDetailResume=calls.filter(c=>c.path==='/rest/v1/accounts').length;
    await page.evaluate(()=>{window.__dailyTest.age();window.dispatchEvent(new Event('focus'))});
    await page.waitForFunction(()=>window.__dailyTest.state().resumePending);
    assert.equal(calls.filter(c=>c.path==='/rest/v1/accounts').length,beforeDetailResume,'an open detail defers account reload');
    assert.equal(await page.locator('#detailReason').inputValue(),'실적 발표까지 유지하는 검증용 초안');
    assert.equal(await page.locator('#detailReview').inputValue(),'다음 실적 발표에서 매출 확인');
    await page.locator('#detailClose').click();
    await page.locator('#detailModal').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().resumePending);
    assert.equal(calls.filter(c=>c.path==='/rest/v1/accounts').length,beforeDetailResume+1,'closing the detail releases the deferred reload once');
    assert.equal(await page.locator('#stockPnlSearch').inputValue(),'ARM');
    await page.locator('[data-performance-detail="ARM"]').click();
    await page.locator('#detailDecisionForm').waitFor({state:'visible'});
    assert.equal(await page.locator('#detailReason').inputValue(),'실적 발표까지 유지하는 검증용 초안');
    assert.equal(await page.locator('#detailReview').inputValue(),'다음 실적 발표에서 매출 확인');
    assert.deepEqual(forbidden,[],'no model generation, decision write or real external request occurs');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:resolve(output,name+'-draft-restored.png')});
    console.log('Build209 daily '+name+': stored-session startup, three screens, delayed resume, input/period/filter/scroll preservation and deferred draft reload passed');
  }catch(error){await page.screenshot({path:resolve(output,name+'-failure.png')}).catch(()=>{});throw error}
  finally{coreDelay?.release();pnlDelay?.release();await context.close();await browser.close()}
}
