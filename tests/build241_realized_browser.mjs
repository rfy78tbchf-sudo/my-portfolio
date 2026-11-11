import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync('index.html','utf8'),fixtures=JSON.parse(fs.readFileSync('mobile-artifacts/build241/rpc-fixture.json','utf8'));
const hook=`
  kstDate=function(){return '2030-01-10'};resumeLiveView=function(){return Promise.resolve()};
  rpc=function(){return Promise.resolve({ok:true,items:[]})};bindBrokerDay=function(){};
  currentTab='performance';stockView='realized';stockPeriod='1W';
  live={stockPnl:null,accounts:[],holdings:[],securityMap:{},stockRealized:${JSON.stringify(fixtures.calculated)},stockRealizedPeriod:'1W',stockRealizedDay:'2030-01-10'};
  window.__pnlFixture=function(data){live.stockRealized=data;render(true)};showApp('live');
`;
const source=html.replace('  restoreLogin();',hook);
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://pnl.test/'?r.fulfill({contentType:'text/html',body:source}):r.abort());await page.goto('https://pnl.test/');
  const fonts='node_modules/@fontsource/noto-sans-kr/files/';await page.addStyleTag({content:fs.readdirSync(fonts).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(fonts+f).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
  await page.locator('.performance-hero .asset').waitFor();assert.match(await page.locator('.performance-hero').innerText(),/20원/);
  await page.locator('.sale-row-details>summary').tap();await page.locator('.stock-row-evidence>summary').tap();assert.match(await page.locator('.stock-row-evidence').innerText(),/2030-01-04/);assert.doesNotMatch(await page.locator('.stock-row-evidence').innerText(),/2030-01-05/);
  await page.evaluate(data=>window.__pnlFixture(data),fixtures.mixed);assert.match(await page.locator('.performance-position').innerText(),/자료 확인 필요/);assert.doesNotMatch(await page.locator('.performance-hero .asset').innerText(),/0원/);
  await page.evaluate(data=>window.__pnlFixture(data),fixtures.outsideBefore);assert.equal(await page.locator('.performance-position').count(),1);
  await page.evaluate(data=>window.__pnlFixture(data),fixtures.outsideAfter);assert.equal(await page.locator('.performance-position').count(),0);assert.match(await page.locator('.performance-hero .asset').innerText(),/내역 없음/);
  await page.evaluate(data=>window.__pnlFixture(data),fixtures.calculated);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name}/${width}/${zoom} overflow`);
  const amounts=await page.locator('.performance-hero .asset,.contribution-pill').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(amounts.every(e=>e.scroll<=e.width+1),'amount text fits');
  if(width===390)await page.screenshot({path:`mobile-artifacts/build241/${name}-${width}-${zoom}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'realized RPC output, period removal, unknown preservation, touch disclosure and amount geometry passed');
 }}finally{await browser.close()}
}
