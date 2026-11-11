import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const source=fs.readFileSync('index.html','utf8');
const audit={ok:true,period:'1W',period_start:'2026-11-03',period_end:'2026-11-09',opening_date:'2026-11-02',opening_at:'2026-11-02T12:00:00Z',closing_at:'2026-11-09T12:00:00Z',recorded_opening_nav:10000,recorded_closing_nav:11000,recorded_asset_change:1000,recorded_external_flow:0,external_flow_confirmed:true,primary_asset_path_pnl:1000,whole_pnl_verified:false,whole_pnl:null,reasons:['CASH_FX_COMPONENTS_UNVERIFIED'],data_version:'synthetic-v1'};
audit.opening_settlement_bridge={ok:true,quantity_matches:true,pending_settlement_net:-1010,remaining_component_gap:0,items:[{symbol:'TEST',pending_buy_quantity:10,pending_sell_quantity:0,quantity_matches:true,trades:[{execution_date:'2026-11-02',settlement_date:'2026-11-04',type:'buy',net_cash:-1010}]}]};
audit.closing_settlement_bridge={ok:true,quantity_matches:false,matched_trade_net:null,remaining_component_gap:null,items:[{symbol:'TEST',pending_buy_quantity:10,pending_sell_quantity:10,quantity_matches:false,trades:[]}]};
const pnl={ok:true,period:'1W',period_start:'2026-11-03',period_end:'2026-11-09',complete:true,pnl_krw:-200,krw_included_count:1,candidate_count:1,items:[{symbol:'TEST',name:'Synthetic position',currency:'KRW',pnl_krw:-200,pnl_local:-200,provisional_amount:true,end_quantity:1}],reconciliation:audit};
const hook=`
 session={accessToken:'synthetic'};kstDate=function(){return '2026-11-09'};
 resumeLiveView=function(){return Promise.resolve()};loadStockRealized=function(){return false};brokerDayCard=function(){return ''};
 rpc=function(){return Promise.resolve({ok:false})};currentTab='performance';stockPeriod='1W';period='1W';
 live={stockPnl:${JSON.stringify(pnl)},stockPnlFetchedAt:Date.now(),stockPnlCacheDay:'2026-11-09',stockPnlCache:{},stockPnlRequests:{},accounts:[{id:'synthetic'}],holdings:[],securityMap:{},snapshots:[{snapshot_date:'2026-11-09',total_assets:11000}],homeChart:{reconciliation:${JSON.stringify(audit)},items:[{date:'2026-11-02',total_assets:10000},{date:'2026-11-09',total_assets:11000}]}};
 window.testState=function(){return {period:period,stockPeriod:stockPeriod,scope:performanceAssetScope}};showApp('live');
`;
fs.mkdirSync('mobile-artifacts/build254',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,402,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://trust.test/'?r.fulfill({contentType:'text/html',body:source.replace('  restoreLogin();',hook)}):r.abort());
  await page.goto('https://trust.test/');
  const fonts='node_modules/@fontsource/noto-sans-kr/files/';await page.addStyleTag({content:fs.readdirSync(fonts).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(fonts+f).toString('base64')})}`).join('')+'body{font-family:TestKorean,sans-serif}'});
  assert.match(await page.locator('.performance-hero').first().innerText(),/전체 손익 확인 중/);
  assert.doesNotMatch(await page.locator('.performance-hero').first().locator('.asset').innerText(),/200/);
  assert.match(await page.locator('.performance-hero').nth(1).innerText(),/추정 포함/);
  await page.locator('.nav-reconciliation>summary').click();
  assert.match(await page.locator('.nav-reconciliation').innerText(),/1,000원/);
  assert.match(await page.locator('.nav-reconciliation').innerText(),/외화 현금/);
  await page.locator('.settlement-evidence>summary').first().click();
  assert.match(await page.locator('.settlement-evidence').first().innerText(),/-1,010원/);
  assert.match(await page.locator('.settlement-evidence').first().innerText(),/전체손익 검증 완료를 뜻하지 않습니다/);
  await page.locator('.settlement-evidence>summary').nth(1).click();
  assert.match(await page.locator('.settlement-evidence').nth(1).innerText(),/미확인/);
  assert.deepEqual(await page.locator('.settlement-evidence').nth(1).locator('.financial-row strong').allTextContents(),['미확인','미확인']);
  await page.evaluate(()=>document.documentElement.style.zoom='1.25');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.locator('[data-performance-scope="stocks"]').click();
  assert.match(await page.locator('.performance-hero').first().innerText(),/-200원/);
  await page.locator('[data-performance-scope="all"]').click();
  await page.locator('[data-tab="home"]').click();
  assert.match(await page.locator('#homeTrend').innerText(),/1,000원/);
  await page.locator('[data-tab="performance"]').click();
  assert.match(await page.locator('.performance-hero').first().innerText(),/전체 손익 확인 중/);
  assert.deepEqual(await page.evaluate(()=>window.testState()),{period:'1W',stockPeriod:'1W',scope:'all'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`mobile-artifacts/build254/${name}-${width}.png`,fullPage:true});
  await page.close();console.log(name,width,'all-account/stock scope, provisional status, NAV details, retained period and horizontal layout PASS');
 }}finally{await browser.close()}
}
