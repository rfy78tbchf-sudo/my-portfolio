import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hook=`
  kstDate=function(){return '2026-10-28'};
  window.__wealthTest={db:{},fail:false,conflict:false,calls:[],delay:null};
  rpc=function(name,payload){var t=window.__wealthTest;t.calls.push({name:name,payload:payload});
    if(name==='get_wealth_growth')return Promise.resolve(JSON.parse(JSON.stringify(t.db[payload.p_year]||{year:payload.p_year,revision:0,base:null,months:{}})));
    if(name==='save_wealth_growth'){
      if(t.fail)return Promise.reject(Error('offline'));
      if(t.conflict){t.conflict=false;return Promise.reject(Error('WEALTH_REVISION_CONFLICT'))}
      var p=payload,d=t.db[p.p_year]||{year:p.p_year,revision:0,base:null,months:{}};
      var run=function(){var r={amount:p.p_amount,as_of:p.p_as_of};if(p.p_month===0)d.base=r;else d.months[p.p_month]=r;d.revision++;t.db[p.p_year]=d;return JSON.parse(JSON.stringify(d))};
      if(t.delay)return t.delay.then(run);return Promise.resolve(run());
    }
    if(name==='get_live_period_stock_pnl')return Promise.resolve({ok:true,period_start:'2026-01-01',period_end:'2026-10-27',scope:'KB 종합위탁 · 주식',complete:false,krw_included_count:3,candidate_count:4,items:[{symbol:'A',name:'합성 종목 A',pnl_krw:3000000},{symbol:'B',name:'합성 종목 B',pnl_krw:-5000000,provisional_amount:true},{symbol:'C',name:'합성 종목 C',pnl_krw:null},{symbol:'D',name:'합성 종목 D',pnl_krw:1000000}]});
    return Promise.resolve({});
  };
  resumeLiveView=function(){return Promise.resolve()};
  currentTab='analysis';live={holdings:[],settings:{},accountScope:{ok:true,current_display_total:125000000,current_primary_observed_at:'2026-10-28T01:00:00Z'}};
  showApp('live');
  window.__wealthTest.reload=function(){wealthYears={};render()};
  window.__wealthTest.redraw=function(){render(true)};
`;
const source=html.replace('  restoreLogin();',hook);
fs.mkdirSync('mobile-artifacts/build226',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try {for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://wealth.test/'?r.fulfill({contentType:'text/html',body:source}):r.abort());
  await page.goto('https://wealth.test/');
  const fontDir=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
  await page.addStyleTag({content:fs.readdirSync(fontDir).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fontDir)).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
  await page.locator('#wealthBaseAmount').waitFor();
  assert.equal(await page.locator('#nav [data-tab="analysis"]').innerText(),'자산관리');
  assert.equal(await page.locator('#wealthLegacy').evaluate(e=>e.open),false);
  assert.equal(await page.locator('.wealth-growth').innerText(),'기준 자산과 월 기록이 필요합니다.');
  await page.locator('#wealthBaseAmount').fill('100000000');await page.locator('#wealthBaseForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('기준 자산을 저장'));
  await page.locator('#wealthRecordOpen').click();await page.locator('#wealthUseCurrent').click();
  assert.equal(await page.locator('#wealthAmount').inputValue(),'125000000');assert.equal(await page.locator('#wealthDate').inputValue(),'2026-10-28');
  await page.locator('#wealthRecordForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('.wealth-achievement')?.textContent.includes('125%'));
  assert.match(await page.locator('.wealth-summary').innerText(),/25,000,000/);
  await page.locator('#wealthImpactLoad').click();await page.locator('.wealth-impact-row').first().waitFor();
  assert.match(await page.locator('.wealth-impact-row').first().innerText(),/합성 종목 B/);assert.match(await page.locator('.wealth-scope').innerText(),/3\/4/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,`${name} ${width}/${zoom} overflow`);
  if(width===390)await page.screenshot({path:`mobile-artifacts/build226/${name}-${width}-${zoom}.png`,fullPage:true});
  // Edit the same month, failure keeps input; retry and full state reload read back one record.
  await page.locator('#wealthRecordOpen').click();await page.locator('#wealthAmount').fill('115000000');await page.evaluate(()=>window.__wealthTest.fail=true);
  await page.locator('#wealthRecordForm button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('입력값을 유지'));
  assert.equal(await page.locator('#wealthAmount').inputValue(),'115000000');
  await page.evaluate(()=>window.__wealthTest.fail=false);await page.locator('#wealthRecordForm button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('.wealth-achievement')?.textContent.includes('75%'));
  await page.evaluate(()=>window.__wealthTest.reload());await page.locator('#wealthRecordOpen').waitFor();assert.match(await page.locator('.wealth-total').innerText(),/115,000,000/);
  assert.equal(await page.evaluate(()=>Object.keys(window.__wealthTest.db[2026].months).length),1);
  // Monthly date mismatches rejected; old month cannot be filled with current balances.
  await page.locator('#wealthRecordOpen').click();await page.locator('#wealthMonth').selectOption('9');await page.locator('#wealthUseCurrent').click();assert.match(await page.locator('#wealthSource').innerText(),/선택한 달/);
  await page.locator('#wealthAmount').fill('90000000');await page.locator('#wealthDate').fill('2026-10-28');await page.locator('#wealthRecordForm button[type="submit"]').click();assert.match(await page.locator('#wealthStatus').innerText(),/기록 월/);
  await page.locator('#wealthDate').fill('2026-09-30');await page.evaluate(()=>window.__wealthTest.conflict=true);await page.locator('#wealthRecordForm button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('다른 화면'));
  assert.equal(await page.locator('#wealthAmount').inputValue(),'90000000');await page.locator('#wealthRecordForm button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#wealthStatus')?.textContent.includes('9월 실적을 저장'));
  // Latest month is chronological, not last edited; select and return to another year.
  assert.match(await page.locator('.wealth-total').innerText(),/115,000,000/);
  await page.locator('#wealthYear').selectOption('2025');await page.locator('#wealthBaseAmount').waitFor();assert.match(await page.locator('.wealth-impact').innerText(),/아직 지원하지/);
  await page.locator('#wealthYear').selectOption('2026');assert.match(await page.locator('.wealth-total').innerText(),/115,000,000/);
  assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'wealth save/failure/retry/reload/conflict/year/TOP3 passed');
 }}finally{await browser.close()}
}
