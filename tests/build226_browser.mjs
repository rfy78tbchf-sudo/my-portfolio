// Automatic wealth journey (Build227); real app rendering, synthetic RPC boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hook=`
  kstDate=function(){return '2026-10-28'};
  window.__wealthTest={fail:false,failRead:false,conflict:false,calls:[],db:{ok:true,today:'2026-10-28',plan:{version:2,base_amount:100000000,base_date:'2026-09-28',std_rate:20,best_rate:30,revision:0},current:{amount:110000000,as_of:'2026-10-28'},records:[{as_of:'2026-10-15',amount:105000000,finalized:true}]}};
  rpc=function(name,payload){var t=window.__wealthTest;t.calls.push({name:name,payload:payload});
    if(name==='get_wealth_dashboard')return t.failRead?Promise.reject(Error('offline')):Promise.resolve(JSON.parse(JSON.stringify(t.db)));
    if(name==='set_wealth_scenarios'){
      if(t.fail)return Promise.reject(Error('offline'));
      if(t.conflict){t.conflict=false;t.db.plan.revision++;return Promise.reject(Error('WEALTH_REVISION_CONFLICT'))}
      Object.assign(t.db.plan,{std_rate:payload.p_std,best_rate:payload.p_best,revision:t.db.plan.revision+1});return Promise.resolve(JSON.parse(JSON.stringify(t.db.plan)));
    }
    if(name==='get_live_period_stock_pnl')return Promise.resolve({ok:true,period_start:'2026-01-01',period_end:'2026-10-27',scope:'KB 종합위탁 · 주식',complete:false,krw_included_count:3,candidate_count:4,items:[{symbol:'A',name:'합성 종목 A',pnl_krw:3000000},{symbol:'B',name:'합성 종목 B',pnl_krw:-5000000,provisional_amount:true},{symbol:'C',name:'합성 종목 C',pnl_krw:null},{symbol:'D',name:'합성 종목 D',pnl_krw:1000000}]});
    return Promise.resolve({});
  };
  resumeLiveView=function(){return Promise.resolve()};
  currentTab='analysis';live={holdings:[],settings:{}};showApp('live');
  window.__wealthTest.reload=function(){wealthAuto=null;render()};
  window.__wealthTest.redraw=function(){render(true)};
`;
const source=html.replace('  restoreLogin();',hook);fs.mkdirSync('mobile-artifacts/build227',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try {for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://wealth.test/'?r.fulfill({contentType:'text/html',body:source}):r.abort());await page.goto('https://wealth.test/');
  const fontDir=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
  await page.addStyleTag({content:fs.readdirSync(fontDir).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fontDir)).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
  await page.locator('.wealth-total').waitFor();assert.match(await page.locator('.wealth-total').innerText(),/110,000,000/);
  assert.equal(await page.locator('#wealthBaseAmount,#wealthAmount,#wealthRecordForm').count(),0,'no amount entry or manual monthly actions');
  assert.equal(await page.locator('#wealthBase').evaluate(e=>e.open),false);assert.equal(await page.locator('#wealthScenario').evaluate(e=>e.open),false);
  assert.match(await page.locator('.wealth-record').innerText(),/2026-10-15/);assert.match(await page.locator('.wealth-record').innerText(),/2026-11-15/);
  assert.match(await page.locator('.wealth-future').innerText(),/2030년 말/);assert.ok(await page.locator('.wealth-milestones').isVisible());
  const before=await page.locator('.wealth-target').first().innerText();
  await page.locator('#wealthScenario>summary').click();await page.locator('#wealthStd').fill('15');await page.locator('#wealthBest').fill('25');
  await page.evaluate(()=>window.__wealthTest.fail=true);await page.locator('#wealthScenarioForm button').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('입력값을 유지'));
  assert.equal(await page.locator('#wealthStd').inputValue(),'15');assert.equal(await page.locator('.wealth-target').first().innerText(),before);
  await page.evaluate(()=>window.__wealthTest.fail=false);await page.locator('#wealthScenarioForm button').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('적용했습니다'));
  assert.notEqual(await page.locator('.wealth-target').first().innerText(),before);assert.match(await page.locator('#wealthBase>summary').innerText(),/100,000,000/);
  await page.evaluate(()=>window.__wealthTest.reload());await page.locator('.wealth-total').waitFor();assert.match(await page.locator('.wealth-scenario-title').first().innerText(),/15%/);
  await page.locator('#wealthImpactLoad').click();await page.locator('.wealth-impact-row').first().waitFor();assert.match(await page.locator('.wealth-impact-row').first().innerText(),/종목 B/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`${name} ${width}/${zoom} overflow`);
  if(width===390)await page.screenshot({path:`mobile-artifacts/build227/${name}-${width}-${zoom}.png`,fullPage:true});
  await page.locator('#wealthScenario>summary').click();await page.locator('#wealthStd').fill('18');await page.locator('#wealthBest').fill('28');await page.evaluate(()=>window.__wealthTest.conflict=true);await page.locator('#wealthScenarioForm button').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('다른 화면'));
  assert.equal(await page.locator('#wealthStd').inputValue(),'18');await page.locator('#wealthScenarioForm button').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('적용했습니다'));
  await page.evaluate(()=>{window.__wealthTest.db.current.amount=120000000;window.__wealthTest.reload()});await page.waitForFunction(()=>document.querySelector('.wealth-total')?.textContent.includes('120,000,000'));
  assert.match(await page.locator('#wealthBase>summary').innerText(),/100,000,000/);assert.match(await page.locator('.wealth-record').innerText(),/105,000,000/,'live changes do not change the 15th record');
  await page.evaluate(()=>{window.__wealthTest.failRead=true;window.__wealthTest.reload()});await page.locator('#wealthRetry').waitFor();await page.evaluate(()=>window.__wealthTest.failRead=false);await page.locator('#wealthRetry').click();await page.locator('.wealth-total').waitFor();
  assert.equal(await page.evaluate(()=>window.__wealthTest.calls.filter(c=>c.name==='save_wealth_growth').length),0);
  assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'automatic baseline/future/scenarios/retry/conflict/monthly record passed');
 }}finally{await browser.close()}
}
