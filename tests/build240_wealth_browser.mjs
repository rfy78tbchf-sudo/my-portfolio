import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hook=`
  kstDate=function(){return '2027-01-01'};
  var previous={year:2026,start_date:'2026-01-01',base_amount:100000000,std_rate:20,best_rate:30,std_target:120000000,best_target:130000000,end_amount:125000000,finalized_at:'2027-01-01'};
  var thisYear={year:2027,start_date:'2027-01-01',base_amount:125000000,std_rate:20,best_rate:30,std_target:150000000,best_target:162500000,end_amount:null,finalized_at:null};
  window.__annual={calls:[],db:{ok:true,today:'2027-01-01',plan:{version:2,base_amount:80000000,base_date:'2025-10-28',std_rate:20,best_rate:30,revision:0},current:{amount:125000000},current_year:thisYear,years:[{...previous,year:2025,start_date:'2025-10-28',base_amount:80000000,std_target:82600000,best_target:83800000,end_amount:100000000},previous,thisYear],records:[{as_of:'2026-12-15',amount:123000000,finalized:true}]}};
  rpc=function(name,payload){var t=window.__annual;t.calls.push(name);
    if(name==='get_wealth_dashboard')return Promise.resolve(JSON.parse(JSON.stringify(t.db)));
    if(name==='set_wealth_scenarios'){Object.assign(t.db.plan,{std_rate:payload.p_std,best_rate:payload.p_best,revision:t.db.plan.revision+1});Object.assign(t.db.current_year,{std_rate:payload.p_std,best_rate:payload.p_best,std_target:Math.round(t.db.current_year.base_amount*(1+payload.p_std/100)),best_target:Math.round(t.db.current_year.base_amount*(1+payload.p_best/100))});return Promise.resolve({...t.db.plan})}
    return Promise.resolve({});
  };
  resumeLiveView=function(){return Promise.resolve()};currentTab='analysis';live={holdings:[],securityMap:{},settings:{}};showApp('live');
  window.__annual.reload=function(){wealthAuto=null;render()};
`;
const source=html.replace('  restoreLogin();',hook);fs.mkdirSync('mobile-artifacts/build240',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try {for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://annual.test/'?r.fulfill({contentType:'text/html',body:source}):r.abort());await page.goto('https://annual.test/');
  const fonts=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
  await page.addStyleTag({content:fs.readdirSync(fonts).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fonts)).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
  await page.locator('.wealth-total').waitFor();assert.match(await page.locator('.wealth-target').first().innerText(),/150,000,000/);
  assert.match(await page.locator('.wealth-summary').innerText(),/올해 시작 125,000,000/);
  const row=page.locator('[data-wealth-year="2026"]');assert.equal(await row.evaluate(e=>e.open),false);
  assert.match(await row.locator(':scope > summary').innerText(),/STD 초과 달성 · BEST 미달/);
  await row.locator(':scope > summary').tap();assert.match(await row.innerText(),/125%/);assert.match(await row.innerText(),/5,000,000원 초과 · 25% 초과/);assert.match(await row.innerText(),/5,000,000원 부족/);
  await row.locator('.more-list>summary').tap();assert.match(await row.innerText(),/2026-12-15/);
  const history=await row.locator('.wealth-year-body').innerText();
  assert.doesNotMatch(await page.locator('.wealth-record').innerText(),/2026-12-15/,'past monthly stays in its own year');
  assert.equal(await page.evaluate(()=>window.__annual.calls.length),1,'expanding history needs no extra RPC');
  await page.locator('#wealthScenario>summary').click();await page.locator('#wealthStd').fill('15');await page.locator('#wealthBest').fill('25');await page.locator('#wealthScenarioForm button').click();
  await page.waitForFunction(()=>document.querySelector('#wealthStatus').textContent.includes('적용했습니다'));
  assert.match(await page.locator('.wealth-target').first().innerText(),/143,750,000/);assert.equal(await row.evaluate(e=>e.open),true,'history stays expanded after redraw');
  if(!await row.locator('.more-list').evaluate(e=>e.open))await row.locator('.more-list>summary').click();assert.equal(await row.locator('.wealth-year-body').innerText(),history,'past goal, actual and monthly record immutable');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`${name} ${width}/${zoom} overflow`);
  if(width===390)await page.screenshot({path:`mobile-artifacts/build240/${name}-${width}-${zoom}.png`,fullPage:true});
  await page.evaluate(()=>{window.__annual.db.current_year.base_amount=null;window.__annual.db.current_year.std_target=null;window.__annual.db.current_year.best_target=null;window.__annual.db.years[1].end_amount=null;window.__annual.db.years[1].finalized_at=null;window.__annual.reload()});
  await page.locator('.wealth-total').waitFor();assert.match(await page.locator('.wealth-target').first().innerText(),/전년 말 자산 확인 중/);assert.match(await page.locator('.wealth-history').innerText(),/연말 자료 확인 중/);
  assert.doesNotMatch(await page.locator('.wealth-summary').innerText(),/NaN|Infinity|0원 대비/);assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'annual goals/history/scenarios/missing data/mobile passed');
 }}finally{await browser.close()}
}
