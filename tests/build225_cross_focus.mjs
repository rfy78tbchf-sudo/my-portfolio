import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('  function chartMovingAverages('),html.indexOf('  function heatmapHtml('));
const scope=vm.createContext({esc:String,price:(v,c)=>`${Number(v).toFixed(2)} ${c}`,money:String});
vm.runInContext(code,scope);
// Oscillating history exercises both directions, distinct pair dates, and an event outside the saved viewport.
const points=Array.from({length:265},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close:150+25*Math.sin(i/11)+7*Math.cos(i/3),currency:'USD',source:'daily'}));
const rows=scope.dailyMaCrosses(points,'USD');
assert.equal(new Set(rows.map(r=>r.event.kind)).size,2);
assert.ok(new Set(rows.map(r=>r.event.date)).size>1);
fs.mkdirSync('mobile-artifacts/build225',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,402,430])for(const zoom of [1,1.25]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Synthetic route enables real localStorage without a network request.
  await page.route('https://chart.test/**',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('https://chart.test/');
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+html.split('<style>')[1].split('</style>')[0]+'</style><div class="detail-modal"><section class="detail-sheet" style="zoom:'+zoom+'"><header class="detail-head"><b>테스트 종목</b><button class="close-btn">×</button></header><div style="height:160px">보유 현황 · 내 판단</div>'+scope.securityChart(points,'USD')+'<div style="height:140px"></div></section></div>');
  const fontDir=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
  await page.addStyleTag({content:fs.readdirSync(fontDir).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fontDir)).toString('base64')})}`).join('')+'body{font-family:TestKorean,sans-serif}'});
  await page.addScriptTag({content:'var price=(v,c)=>Number(v).toFixed(2)+" "+c;'+code});
  await page.evaluate(points=>bindSecurityChart(document.querySelector('.security-price-interactive'),points,'USD',{period:'1',ma:[20,60]}),points);
  await page.evaluate(()=>document.fonts.ready);
  const root=page.locator('.security-price-interactive'),focus=page.locator('.ma-cross-focus'),marker=page.locator('.security-ma-event');
  const state=()=>root.evaluate(r=>({start:r.dataset.chartStart,count:r.dataset.chartCount,period:r.querySelector('[data-chart-period][aria-pressed="true"]')?.dataset.chartPeriod,ma:[...r.querySelectorAll('[data-ma-period]:checked')].map(e=>Number(e.dataset.maPeriod)),date:r.querySelector('[data-price-date]').textContent,hidden:r.querySelector('.security-crosshair').classList.contains('hidden'),preferences:localStorage.getItem('portfolio.chart-preferences.v1')}));
  await page.locator('[data-chart-zoom="in"]').click();await page.locator('[data-chart-zoom="in"]').click();
  const initial=await state();assert.ok(rows.some(r=>r.event.index<Number(initial.start)));assert.equal(await focus.isVisible(),false);
  await page.locator('.ma-cross-details>summary').click();
  for(const row of rows){
   await page.locator('.ma-cross-details [data-cross-period="'+row.period+'"]').click();
   assert.ok(await focus.isVisible());assert.ok(await marker.isVisible());
   const selected=await state();assert.deepEqual(selected.ma,[5,row.period]);assert.equal(selected.preferences,initial.preferences,'inspection must not change saved preferences');
   assert.ok(row.event.index>=Number(selected.start)&&row.event.index<Number(selected.start)+Number(selected.count));
   assert.equal(await page.locator('[data-cross-date]').innerText(),row.event.date+' · 발생일');
   assert.match(await focus.innerText(),new RegExp(row.event.kind==='golden'?'골든크로스':'데드크로스'));
   assert.equal(await page.locator('[data-price-date]').innerText(),row.event.date+' · 종가');
   assert.equal(await page.locator('[data-ma-line="5"]').isVisible(),true);
   assert.equal(await page.locator('[data-ma-line="'+row.period+'"]').isVisible(),true);
   const fast=await page.locator('[data-cross-fast]').evaluate(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}));
   const slow=await page.locator('[data-cross-slow]').evaluate(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}));
   assert.equal(fast.x,slow.x);assert.ok(fast.x>=10&&fast.x<=350&&fast.y>=35&&fast.y<=190&&slow.y>=35&&slow.y<=190);
   // Marker is on each MA at the event day, not on the unrelated closing price.
   for(const [period,point] of [[5,fast],[row.period,slow]]){
    const poly=await page.locator('[data-ma-line="'+period+'"] polyline').last().getAttribute('points');
    assert.ok(poly.split(' ').some(pair=>{const [x,y]=pair.split(',').map(Number);return Math.abs(x-point.x)<.06&&Math.abs(y-point.y)<.06}));
   }
   assert.ok(row.event.kind==='golden'?fast.y<slow.y:fast.y>slow.y);
   const bounds=await focus.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=844,'event status visible after jump');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const sheet=page.locator('.detail-sheet');assert.ok(await sheet.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   for(const control of [focus.locator('button'),page.locator('.ma-cross-details [data-cross-period="'+row.period+'"]')])assert.ok(await control.evaluate(e=>e.getBoundingClientRect().height>=44));
   if(row.period===60)await page.screenshot({path:`mobile-artifacts/build225/${name}-${width}-${zoom}.png`});
  }
  // Switching pairs preserves the original viewport, not the previous inspected pair.
  await page.locator('[data-cross-clear]').click();assert.deepEqual(await state(),initial);assert.equal(await marker.isVisible(),false);
  const event=page.locator('.ma-cross-events [data-cross-period]').first();
  await event.click();await event.click();assert.deepEqual(await state(),initial);
  // Keyboard activation and deliberate navigation leave no stale event label/marker.
  await event.focus();await page.keyboard.press('Enter');assert.equal(await focus.isVisible(),true);
  await page.locator('[data-chart-period="3"]').click();assert.equal(await focus.isVisible(),false);assert.deepEqual((await state()).ma,[20,60]);
  await event.click();await page.locator('[data-chart-zoom="in"]').click();assert.equal(await focus.isVisible(),false);
  await event.click();await page.locator('[data-ma-period="120"]').setChecked(true);assert.equal(await focus.isVisible(),false);assert.deepEqual((await state()).ma,[20,60,120]);
  await event.click();await page.locator('.security-chart-hit').tap();assert.equal(await focus.isVisible(),false);assert.equal(await marker.isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close()}
 console.log(`Build225: ${name} 390/402/430px at 100%/125%; cross-date jump, MA marker accuracy, restore, touch/keyboard, no saved preference changes passed`);
}
