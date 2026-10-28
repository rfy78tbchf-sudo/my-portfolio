import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

// Actual startup, stored-session authentication, API queue, resume events and renderers.
// Every browser request is fulfilled/aborted locally; all account values are synthetic.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(process.env.UI_SOURCE||resolve(root,'index.html'),'utf8');
const apiOrigin=source.match(/var SUPABASE_URL='([^']+)'/)[1];
const site='https://daily.portfolio.test/';
const output=resolve(root,process.env.UI_OUTPUT||'mobile-artifacts/tab-profile234');
mkdirSync(output,{recursive:true});
const hook=`
  window.__dailyTest={
    refresh:function(){return refreshLive(true,false)},
    age:function(){lastLiveLoadAt=Date.now()-4*60*1000},
    state:function(){return {swingLoaded:Object.keys(live&&live.swingPrices||{}).length,wealthLoading:wealthState().loading,tab:currentTab,period:stockPeriod,query:stockPnlQuery,scope:stockPnlScope,
      resumePending:liveResumePending,renderPending:contentRenderPending,loadEpoch:liveLoadEpoch,
      idle:!liveRefreshPromise&&!liveLoadPromise&&!liveResumePromise&&!liveReadsActive&&!liveReadQueue.length,
      pnl:live&&live.stockPnl&&live.stockPnl.pnl_krw,error:liveError,deferred:!!(live&&live.detailsDeferred),enrichment:!!(live&&live.enrichmentLoading),background:!!backgroundSyncPromise}}
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

const samples=[],verify=process.argv.includes('--verify');
for(let run=0;run<(verify?(process.env.CHROMIUM_ONLY?1:2):5);run++){
 const name=verify&&run===1?'webkit':'chromium',engine=name==='webkit'?webkit:chromium;
  scope.current_display_total=5400000; // Each browser starts with its own baseline value.
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:'daily-browser-'+name,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await context.addInitScript(({token,key})=>localStorage.setItem(key,JSON.stringify({accessToken:token,refreshToken:'synthetic-local-refresh',expiresAt:Date.now()+3600000})),{token:jwt,key:'my_portfolio_session_v2'});
  const calls=[],forbidden=[],errors=[];let wealthGate=null,generation=0,coreDelay=null,pnlDelay=null,failCore=false,extraDelay=null,backgroundDelay=deferred(),failExtra=false;
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
    calls.push({path,body});await new Promise(r=>setTimeout(r,50));
    if(path.startsWith('/functions/')){
      if(body.action==='sync-current')return json(route,{ok:true});
      if(body.action==='sync-history-month'||body.action==='sync-prices'){await backgroundDelay.wait;return json(route,{ok:true})}

      if(body.action==='overseas-day-pnl')return json(route,{ok:true,available:false,items:[]});
      if(body.action==='sync-target-prices'&&body.security_ids?.every(id=>securities.some(s=>s.id===id)))return json(route,{ok:true,results:[]});
      forbidden.push(path+':'+String(body.action||''));return json(route,{message:'Live writes and model calls are blocked'},403);
    }
    if(path.startsWith('/rest/v1/rpc/')){
      const rpc=path.split('/').pop();if(rpc==='get_wealth_dashboard'&&wealthGate){wealthGate.entered();await wealthGate.wait;}
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
        get_investment_decisions:[],get_investment_breakout_rule:null,get_live_realized_sales:{ok:true,items:[],period:body.p_period},get_pending_kb_position_events:[]};
      return json(route,Object.hasOwn(values,rpc)?values[rpc]:{ok:false,items:[]});
    }
    if(method!=='GET'){forbidden.push(path);return json(route,{message:'Writes are blocked'},403)}
    const table=path.split('/').pop();
    if(table==='holdings'&&coreDelay){const pending=coreDelay;pending.entered();await pending.wait}
    if(table==='holdings'&&failCore)return json(route,{message:'synthetic offline'},503);
    if(table==='transactions'&&failExtra)return json(route,{message:'synthetic extra failure'},503);
    const tables={accounts,securities,holdings,daily_account_snapshots:snapshots,live_holding_display_basis:basis,daily_security_prices:prices,investment_decisions:[],ai_analysis_history:[]};
    return json(route,tables[table]||[]);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  if(name==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  try{
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__dailyTest?.state().idle&&window.__dailyTest.state().loadEpoch>0);
    const transitions=[],retained=[];
    const cdp=name==='chromium'?await context.newCDPSession(page):null;
    for(let round=0;round<3;round++){
      for(const tab of ['portfolio','performance','analysis','home']){
        calls.length=0;
        await page.evaluate(tab=>{window.__tabStart=performance.now();document.querySelector('#nav [data-tab="'+tab+'"]').click()},tab);
        let firstContentMs=null;
        if(tab==='portfolio'){
          await page.waitForFunction(()=>document.querySelectorAll('.portfolio-list [data-security-id]').length===4&&document.querySelector('.portfolio-list').textContent.includes('1,000,000'));
          firstContentMs=Math.round(await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__tabStart))))));
        }
        let swingReadyMs=null;
        if(tab==='portfolio'){
          await page.waitForFunction(()=>window.__dailyTest.state().swingLoaded===4);
          swingReadyMs=Math.round(await page.evaluate(()=>performance.now()-window.__tabStart));
        }
        await page.waitForFunction(tab=>{const s=window.__dailyTest.state();return s.tab===tab&&s.idle&&!s.wealthLoading&&(tab!=='portfolio'||!s.deferred)&&(tab!=='analysis'||document.querySelector('.wealth-total')?.textContent.includes('5,400,000'))},tab);
        const readyMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__tabStart)))));
        transitions.push({round:round+1,tab,readyMs:Math.round(readyMs),firstContentMs,swingReadyMs,requests:calls.length,names:calls.map(c=>c.path.split('/').pop())});
        assert.equal(await page.locator('#nav [aria-current="page"]').getAttribute('data-tab'),tab);
      }
      if(cdp){await cdp.send('HeapProfiler.collectGarbage');retained.push(await cdp.send('Memory.getDOMCounters'));}
    }
    if(verify){
      await page.reload();await page.waitForFunction(()=>window.__dailyTest.state().idle&&window.__dailyTest.state().loadEpoch>0);
      wealthGate=deferred();calls.length=0;
      await page.locator('#nav [data-tab="analysis"]').click();await waitGate(wealthGate,'wealth');
      await page.locator('#nav [data-tab="home"]').click();
      await page.evaluate(()=>window.__homeNode=document.querySelector('#content').firstElementChild);
      wealthGate.release();await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().wealthLoading);
      assert.equal(await page.evaluate(()=>window.__homeNode===document.querySelector('#content').firstElementChild),true,'late wealth response does not rerender the current home tab');
      await page.locator('#nav [data-tab="analysis"]').click();await page.locator('.wealth-total').waitFor();
      assert.equal(calls.filter(c=>c.path.endsWith('/get_wealth_dashboard')).length,1,'return reuses the completed in-flight read');
    }
    samples.push({run:run+1,engine:name,transitions,retained});
    assert.deepEqual(errors,[]);
  }finally{if(wealthGate)wealthGate.release();if(extraDelay)extraDelay.release();backgroundDelay.release();await context.close();await browser.close()}
}
console.log(JSON.stringify({conditions:'5 fresh Chromium sessions; each 3 rounds portfolio/performance/analysis/home; 390x844 CPU4x; synthetic 50ms API delay, real request queue, SW blocked; ready means idle required reads and two rAF callbacks, not presented paint/INP; forced GC on home after each round; --verify uses one session per engine and a gated rapid wealth/home round trip',samples},null,2));
