import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

// Production startup/rendering and API queue; all network responses are isolated synthetic data.
// Selecting a home period stores only a mocked setting; no production writes are reachable.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'index.html'),'utf8');
const apiOrigin=source.match(/var SUPABASE_URL='([^']+)'/)[1];
const site='https://daily.portfolio.test/';
const output=resolve(root,process.env.UI_OUTPUT||'mobile-artifacts/build210-trend');
mkdirSync(output,{recursive:true});
const hook=`
  window.__dailyTest={
    age:function(){lastLiveLoadAt=Date.now()-4*60*1000},
    state:function(){return {tab:currentTab,period:stockPeriod,query:stockPnlQuery,scope:stockPnlScope,
      homePeriod:period,loadedHomePeriod:live&&live.performancePeriod,homeError:live&&live.performanceError,
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
const chartAmount=p=>5400000+({'1M':0,'3M':300000,'6M':600000,'ALL':900000,'1Y':1200000,'YTD':1500000}[p]||0);
const chartFor=p=>({items:snapshots.slice().reverse().map((s,i)=>({date:s.snapshot_date,total_assets:chartAmount(p)-(7-i)*10000}))});
const gate={ok:true,state:'estimated',partial:false,reliable_start:before(30),observed_through:day,investment_pnl:90000,return_estimate_pct:1.7,opening_assets:5310000,closing_assets:5400000,external_flow:0,as_of:now};
const summary={ok:true,return_ready:true,investment_pnl:90000,return_pct:1.7,period_start:before(30),period_end:day,realized_pnl:0,dividends_net:0};
function stockResult(period,generation){
  const items=securities.map((s,i)=>({...s,security_id:s.id,provisional_amount:i===0,end_quantity:10,start_quantity:10,pnl_krw:i===3?null:[110000+generation*10000,-20000,0][i],reason:i===3?'가격 자료 확인 필요':null}));
  return {ok:true,period,period_start:period==='오늘'?day:before(30),period_end:day,basis_at:now,complete:false,all_items_displayed:true,candidate_count:4,source_candidate_count:4,krw_included_count:3,local_only_count:0,pnl_krw:items.slice(0,3).reduce((n,x)=>n+x.pnl_krw,0),items};
}
function deferred(){let release,entered;const wait=new Promise(r=>{release=r}),hit=new Promise(r=>{entered=r});return {wait,hit,release,entered};}
async function waitGate(gate,label){let timer;try{await Promise.race([gate.hit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' request did not arrive')),15000)})])}finally{clearTimeout(timer)}}

for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:'daily-browser-'+name,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await context.addInitScript(({token,key})=>localStorage.setItem(key,JSON.stringify({accessToken:token,refreshToken:'synthetic-local-refresh',expiresAt:Date.now()+3600000})),{token:jwt,key:'my_portfolio_session_v2'});
  const calls=[],forbidden=[],errors=[];let generation=0,coreDelay=null,pnlDelay=null;const periodDelays=new Map(),failedPeriods=new Set();
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
      if(rpc==='set_app_setting'&&body.p_key==='home_period')return json(route,{ok:true});
      if(rpc==='get_live_home_chart'){const delay=periodDelays.get(body.p_period);if(delay){delay.entered();await delay.wait}if(failedPeriods.has(body.p_period))return json(route,{message:'Synthetic chart read failure'},503)}
      if(!rpc.startsWith('get_')&&rpc!=='reconcile_live_cash_flows'){forbidden.push(rpc);return json(route,{message:'Writes are blocked'},403)}
      if(rpc==='get_live_period_stock_pnl'){if(pnlDelay){const pending=pnlDelay;pending.entered();await pending.wait}return json(route,stockResult(body.p_period,generation))}
      const security=securities.find(s=>s.id===body.p_security_id)||securities[0];
      const values={get_app_settings:{},reconcile_live_cash_flows:{ok:true},get_live_current_account_scope:scope,
        get_live_performance_summary:summary,get_live_reliable_performance:gate,
        get_live_home_chart:chartFor(body.p_period),
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
  const idle=()=>page.waitForFunction(()=>window.__dailyTest?.state().idle&&window.__dailyTest.state().loadEpoch>0);
  const trendPeriods=()=>page.locator('#homeTrend .periods');
  const trendTop=()=>trendPeriods().evaluate(el=>el.getBoundingClientRect().top);
  async function selectTrend(period){
    const button=page.locator('#homeTrend .periods [data-period="'+period+'"]');
    await button.scrollIntoViewIfNeeded();const top=await trendTop();await button.click();return top;
  }
  async function stableTrend(top,label){
    assert.ok(await page.locator('#homeTrend').count(),label+': trend remains mounted');
    assert.ok(Math.abs(await trendTop()-top)<3,label+': period control keeps its vertical position');
    assert.ok(await trendTop()>=0&&await trendTop()<700,label+': chart periods stay within the mobile viewport');
  }
  async function visibleActive(selector){
    const rect=await page.locator(selector).evaluate(el=>{const a=el.getBoundingClientRect(),g=el.parentElement.getBoundingClientRect();return {left:a.left,right:a.right,groupLeft:g.left,groupRight:g.right,pressed:el.getAttribute('aria-pressed')}});
    assert.equal(rect.pressed,'true');assert.ok(rect.left>=rect.groupLeft-1&&rect.right<=rect.groupRight+1,'active period stays inside its horizontal strip');
  }
  try{
    await page.goto(site,{waitUntil:'domcontentloaded'});await idle();
    await page.locator('#homeTrend .periods').scrollIntoViewIfNeeded();
    for(const width of [390,402,430]){
      await page.setViewportSize({width,height:844});
      for(const zoom of [1,1.25]){
        await page.evaluate(z=>document.body.style.zoom=String(z),zoom);
        const hit=page.locator('#assetChartHit'),clear=page.getByRole('button',{name:'차트 선택 해제'});
        await hit.scrollIntoViewIfNeeded();
        assert.equal(await clear.isVisible(),false,'no extra action before selection');
        await hit.tap();
        assert.equal(await page.locator('#assetChartTip').isVisible(),true);
        assert.match(await page.locator('#assetChartTip').innerText(),/5,\d{3},000/);
        const rect=await clear.boundingBox();assert.ok(rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=width+1);
        await page.screenshot({path:resolve(output,name+'-chart-selected-'+width+'-'+zoom+'.png')});
        await clear.click();
        assert.equal(await page.locator('#assetChartTip').isVisible(),false,'one tap clears date and amount');
        assert.equal(await page.locator('#assetChartGuide').isVisible(),false);
        await hit.tap();await hit.dispatchEvent('pointercancel',{pointerType:'touch'});
        assert.equal(await clear.isVisible(),false,'native scrolling cancels selection');
        assert.equal(await hit.evaluate(el=>getComputedStyle(el.closest('.asset-chart')).touchAction),'pan-y');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      }
    }
    await page.evaluate(()=>document.body.style.zoom='1');await page.setViewportSize({width:390,height:844});
    await page.locator('#homeTrend .periods').scrollIntoViewIfNeeded();
    const homeRows=await page.locator('#homeHoldings [data-asset-id]').count();
    const oldTotal=await page.locator('#homeTrend .trend-total').textContent();
    const hold=deferred();periodDelays.set('3M',hold);
    const before=await selectTrend('3M');await waitGate(hold,'three-month chart');
    await stableTrend(before,'loading');
    assert.equal(await page.locator('#homeTrend svg').count(),0,'old chart cannot appear under the newly selected period');
    assert.match(await page.locator('#homeTrend .trend-placeholder').innerText(),/최근 3개월.*불러오는 중/);
    assert.equal(await page.locator('#homeTrend').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#homeHoldings [data-asset-id]').count(),homeRows,'home holdings stay available while a chart is loading');
    assert.equal(await page.locator('.hero .pnl').count(),0,'previous-period profit does not acquire the new period label');
    assert.equal(await page.locator('#content .periods').count(),1,'one home period control remains at the chart');
    await page.screenshot({path:resolve(output,name+'-trend-loading.png')});
    hold.release();periodDelays.delete('3M');await idle();
    await stableTrend(before,'loaded');
    assert.notEqual(await page.locator('#homeTrend .trend-total').textContent(),oldTotal);
    assert.match(await page.locator('#homeTrend .trend-total').textContent(),/5,700,000/);

    failedPeriods.add('6M');const errorTop=await selectTrend('6M');
    const retry=page.locator('#homeTrend').getByRole('button',{name:'다시 확인',exact:true});await retry.waitFor();
    await stableTrend(errorTop,'failed');
    assert.match(await page.locator('#homeTrend .chip[aria-pressed="true"]').innerText(),/최근 6개월/);
    assert.equal(await page.locator('#homeTrend svg').count(),0);
    assert.equal(await page.locator('#homeTrend').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#homeHoldings [data-asset-id]').count(),homeRows);
    await page.screenshot({path:resolve(output,name+'-trend-retry.png')});
    failedPeriods.delete('6M');await retry.scrollIntoViewIfNeeded();const retryTop=await trendTop();await retry.click();await idle();
    await stableTrend(retryTop,'retried');assert.match(await page.locator('#homeTrend .trend-total').textContent(),/6,000,000/);

    // An older delayed response must not change the newer selected chart or its label.
    const older=deferred();periodDelays.set('ALL',older);await selectTrend('ALL');await waitGate(older,'older all-period chart');
    await visibleActive('#homeTrend [data-period="ALL"]');
    await selectTrend('1Y');await page.waitForFunction(()=>window.__dailyTest.state().loadedHomePeriod==='1Y');
    older.release();periodDelays.delete('ALL');await idle();
    await visibleActive('#homeTrend [data-period="1Y"]');
    assert.match(await page.locator('#homeTrend .trend-total').textContent(),/6,600,000/);
    assert.match(await page.locator('#homeTrend .chip[aria-pressed="true"]').innerText(),/최근 1년/);

    // Completing a chart after navigation cannot pull the user back into the chart.
    const leaving=deferred();periodDelays.set('YTD',leaving);await selectTrend('YTD');await waitGate(leaving,'chart before navigation');
    await page.locator('#nav [data-tab="portfolio"]').click();const portfolioY=await page.evaluate(()=>scrollY);
    leaving.release();periodDelays.delete('YTD');await idle();
    assert.equal(await page.locator('#nav [aria-current="page"]').getAttribute('data-tab'),'portfolio');
    assert.equal(await page.locator('#homeTrend').count(),0);assert.equal(await page.evaluate(()=>scrollY),portfolioY);

    await page.locator('#nav [data-tab="performance"]').click();await idle();
    await page.locator('[data-stock-period="ALL"]').scrollIntoViewIfNeeded();const performanceY=await page.evaluate(()=>scrollY);
    await page.locator('[data-stock-period="ALL"]').click();await idle();
    await visibleActive('[data-stock-period="ALL"]');
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-performanceY)<3,'revealing the active chip changes horizontal scroll only');
    await page.screenshot({path:resolve(output,name+'-active-period.png')});
    // Build219: the subtotal's missing/estimated scope is inspectable without the long contribution list.
    for(const width of [390,402,430]){
      await page.setViewportSize({width,height:844});
      for(const zoom of [1,1.25]){
        await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
        const coverage=page.locator('.performance-hero .pnl-coverage');
        const summary=coverage.locator('summary');
        assert.match(await page.locator('.performance-hero').innerText(),/계산된 종목 합계/);
        assert.match(await summary.innerText(),/계산 범위 · 3\/4종목 · 추정 1종목 포함/);
        if(await coverage.getAttribute('open')!==null)await summary.click();
        await summary.scrollIntoViewIfNeeded();
        const box=await summary.boundingBox();assert.ok(box.height>=44,'coverage control has a 44px touch target');
        await summary.click();
        assert.match(await coverage.innerText(),/국내 검증 종목/);
        assert.match(await coverage.innerText(),/가격 자료 확인 필요/);
        assert.match(await coverage.innerText(),/0원으로 간주하지 않습니다/);
        assert.match(await coverage.innerText(),/ARM 검증 종목/);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal page overflow');
        const bounds=await coverage.locator('li').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth}}));
        assert.ok(bounds.every(b=>b.left>=0&&b.right<=b.width+1),'missing names and reasons remain inside viewport');
        await page.screenshot({path:resolve(output,name+'-coverage-'+width+'-'+zoom+'.png')});
        await summary.click();
      }
    }
    assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
    console.log('Build210 trend '+name+': chart loading/error/retry stays in place; labels, delayed responses, navigation and horizontal active-period visibility passed');
  }catch(error){await page.screenshot({path:resolve(output,name+'-failure.png')}).catch(()=>{});throw error}
  finally{periodDelays.forEach(delay=>delay.release());await context.close();await browser.close()}
}
