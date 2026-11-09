import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync('index.html','utf8'),complete=JSON.parse(fs.readFileSync('mobile-artifacts/build251/rpc-fixture.json','utf8'));
const partial=structuredClone(complete);
Object.assign(partial,{complete:false,candidate_count:2,source_candidate_count:2});
partial.items.push({symbol:'MISSING',name:'합성 대조 대기 종목',currency:'USD',reason:'시작 보유수량 확인 필요',pnl_krw:null,pnl_local:null,end_quantity:0});
const hook=`
  kstDate=function(){return '2026-11-09'};resumeLiveView=function(){return Promise.resolve()};
  rpc=function(){return Promise.resolve({ok:false,items:[]})};bindBrokerDay=function(){};
  currentTab='performance';stockView='total';stockPeriod='1W';period='1W';
  live={stockPnl:${JSON.stringify(partial)},accounts:[{id:'synthetic'}],holdings:[],securityMap:{},snapshots:[{snapshot_date:'2026-11-09',total_assets:15000}],homeChart:{items:[{date:'2026-11-02',total_assets:10000},{date:'2026-11-09',total_assets:15000}]}};
  window.__pnlFixture=function(data){currentTab='performance';live.stockPnl=data;render(true)};
  window.__homeFixture=function(){currentTab='home';render(true)};
  showApp('live');
`;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://pnl.test/'?r.fulfill({contentType:'text/html',body:html.replace('  restoreLogin();',hook)}):r.abort());await page.goto('https://pnl.test/');
  const fonts='node_modules/@fontsource/noto-sans-kr/files/';await page.addStyleTag({content:fs.readdirSync(fonts).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(fonts+f).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
  const hero=page.locator('.performance-hero').first();await hero.waitFor();
  assert.equal(await hero.locator('.asset').innerText(),'전체 손익 미계산');
  assert.match(await hero.locator('.pnl-subtotal').innerText(),/계산된 종목 합계[\s\S]*150원/);
  assert.match(await hero.innerText(),/2026-11-03 ~ 2026-11-09/);
  await hero.locator('.pnl-coverage>summary').tap();assert.match(await hero.innerText(),/기간 시작 전날 2026-11-02/);assert.match(await hero.innerText(),/홈의 입출금 포함 자산 변화와 계산 범위가 다릅니다/);assert.match(await hero.innerText(),/합성 대조 대기 종목[\s\S]*시작 보유수량 확인 필요/);
  assert.doesNotMatch(await page.locator('[data-pnl-symbol="MISSING"] .contribution-pill').innerText(),/0원/);
  const sizes=await page.locator('.asset,.pnl-subtotal strong,.pnl-subtotal span').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));
  assert.ok(sizes.every(e=>e.scroll<=e.width+1),name+'/'+width+'/'+zoom+' amounts fit');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(width===390)await page.screenshot({path:`mobile-artifacts/build251/${name}-${width}-${zoom}.png`,fullPage:true});
  await page.evaluate(data=>window.__pnlFixture(data),complete);assert.equal(await hero.locator('.asset').innerText(),'+150원');assert.equal(await hero.locator('.pnl-subtotal').count(),0);
  const zero=structuredClone(complete);zero.pnl_krw=0;zero.items[0].pnl_krw=0;await page.evaluate(data=>window.__pnlFixture(data),zero);assert.equal(await hero.locator('.asset').innerText(),'0원');
  const unknown=structuredClone(partial);unknown.pnl_krw=null;await page.evaluate(data=>window.__pnlFixture(data),unknown);assert.equal(await hero.locator('.asset').innerText(),'전체 손익 미계산');assert.match(await hero.locator('.pnl-subtotal').innerText(),/—/);
  await page.evaluate(()=>window.__homeFixture());assert.match(await page.locator('#homeTrend .trend-change').innerText(),/5,000원/);assert.match(await page.locator('#homeTrend .trend-change').innerText(),/입출금 포함 · 투자손익 아님/);
  await page.evaluate(data=>window.__pnlFixture(data),partial);assert.equal(await hero.locator('.asset').innerText(),'전체 손익 미계산');
  assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'partial/full/zero states, basis date, cash-flow distinction, touch disclosure and return passed');
 }}finally{await browser.close()}
}
