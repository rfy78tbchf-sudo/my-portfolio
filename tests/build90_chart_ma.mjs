import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scope=vm.createContext({money:String,price:String,esc:String});
vm.runInContext(html.slice(html.indexOf('  function price('),html.indexOf('\n',html.indexOf('  function price(')))+'\n'+html.slice(html.indexOf('  function chartMovingAverages('),html.indexOf('  function heatmapHtml(')),scope);
const values=Array.from({length:140},(_,i)=>100+i);
const ma=scope.chartMovingAverages(values);
for(const s of ma){assert.equal(s.values[s.period-2],null);assert.equal(s.values[s.period-1],100+(s.period-1)/2);assert.equal(s.values[139],239-(s.period-1)/2)}
const modified=values.slice();modified[139]=999;
assert.deepEqual(Array.from(scope.chartMovingAverages(modified)[0].values.slice(0,139)),Array.from(ma[0].values.slice(0,139)),'no look-ahead');
for(const bad of [null,NaN,Infinity,'']){const data=values.slice();data[50]=bad;const result=scope.chartMovingAverages(data)[0];assert.equal(result.values[54],null);assert.equal(result.values[55],153)}
const points=values.map((close,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close,total_assets:close*100,source:i<70?'a':'b',currency:'USD'}));
assert.equal(scope.chartMovingAverages(values,points)[0].values[73],null);
assert.equal(scope.chartMovingAverages(values,points)[0].values[74],172);
for(const rendered of [scope.securityChart(points,'USD')]){assert.match(rendered,/data-ma-period="120"/);assert.match(rendered,/data-ma-line="20"/);assert.doesNotMatch(rendered,/NaN|Infinity|USD USD|KRW KRW/)}
assert.doesNotMatch(scope.assetChart(points),/data-ma-period/);assert.doesNotMatch(scope.chart(values),/data-ma-period/);
const short=scope.securityChart(points.slice(0,4),'USD');assert.equal((short.match(/ disabled/g)||[]).length,4);
const flat=scope.securityChart(points.map(x=>({...x,close:100,source:'a'})),'USD');assert.doesNotMatch(flat,/NaN|Infinity/);
console.log('Build90: exact SMA, no look-ahead, missing-value/source reset, insufficient data, all time-series renderers passed');
if(process.argv.includes('--browser')){
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('mobile-artifacts/build90',{recursive:true});
 try{for(const width of [360,390,430]){
  const page=await browser.newPage({viewport:{width,height:860},isMobile:true,hasTouch:true});
  const data=points.map(x=>({...x,source:'a'}));
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+html.split('<style>')[1].split('</style>')[0]+'</style><main style="padding:14px"><section class="card"><h3>종목 가격</h3>'+scope.securityChart(data,'USD')+'</section><section class="card" style="margin-top:12px"><h3>다른 종목</h3>'+scope.securityChart(data,'USD')+'</section><section id="asset" class="card"><h3>자산 추이</h3>'+scope.assetChart(data)+'</section><section id="short" class="card">'+short+'</section></main>');
  await page.addScriptTag({content:scope.price.toString()+';'+scope.chartMovingAverages.toString()+';'+scope.chartMaLines.toString()+';'+scope.bindSecurityChart.toString()});
  await page.evaluate(data=>bindSecurityChart(document.querySelector('.security-price-interactive'),data,'USD'),data);
  assert.equal(await page.evaluate(()=>innerWidth),width);
  assert.equal(await page.locator('#asset [data-ma-period]').count(),0);
  const hit=page.locator('.security-chart-hit').first(),readout=page.locator('.security-price-readout').first();
  const box=await hit.boundingBox();
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  const selected=Number(await hit.getAttribute('aria-valuenow'));
  assert.ok(selected===69||selected===70);
  assert.ok((await readout.innerText()).includes(data[selected].date));
  assert.ok((await readout.innerText()).includes(String(data[selected].close)+' USD'));
  await hit.focus();await page.keyboard.press('Home');assert.equal(await hit.getAttribute('aria-valuenow'),'0');
  await page.keyboard.press('End');assert.equal(await hit.getAttribute('aria-valuenow'),'139');
  await page.mouse.move(box.x+box.width*.8,box.y+20);await page.mouse.down();await page.mouse.move(box.x+box.width*.25,box.y+20);await page.mouse.up();
  assert.ok(Number(await hit.getAttribute('aria-valuenow'))<40,'scrub updates selected date');
  assert.notEqual(await page.locator('.security-crosshair').first().evaluate(el=>getComputedStyle(el).display),'none');
  const chart=page.locator('.ma-chart').first();
  assert.equal(await chart.locator('[data-ma-line="20"]').evaluate(el=>getComputedStyle(el).display),'block');
  await chart.locator('[data-ma-period="20"]').uncheck();
  assert.equal(await chart.locator('[data-ma-line="20"]').evaluate(el=>getComputedStyle(el).display),'none');
  await chart.locator('[data-ma-period="120"]').check();
  assert.equal(await chart.locator('[data-ma-line="120"]').evaluate(el=>getComputedStyle(el).display),'block');
  assert.equal(await page.locator('.ma-chart').nth(1).locator('[data-ma-period="20"]').isChecked(),true,'independent chart controls');
  assert.equal(await page.locator('#short input:disabled').count(),4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const root=page.locator('.security-price-interactive').first(),latest=root.locator('.security-latest-price');
  const latestText=await latest.innerText();assert.match(latestText,/239 USD/);
  await root.locator('[data-chart-zoom="in"]').click();
  assert.ok(Number(await root.getAttribute('data-chart-count'))<140);
  assert.equal(await latest.innerText(),latestText,'latest close persists while zooming');
  const count=Number(await root.getAttribute('data-chart-count'));
  await root.locator('[data-chart-pan]').focus();await page.keyboard.press('Home');
  assert.equal(await root.getAttribute('data-chart-start'),'0');
  assert.equal(await latest.innerText(),latestText,'latest close persists outside visible dates');
  const plotted=await root.locator('[data-ma-line="20"] polyline').getAttribute('points');
  assert.equal(plotted.split(' ').length,count-19,'MA uses full history before cropping');
  await root.locator('[data-chart-zoom="reset"]').click();
  assert.equal(await root.getAttribute('data-chart-count'),'140');
  // Use real browser touch input for pinch and two-finger translation.
  const cdp=await page.context().newCDPSession(page),touchBox=await hit.boundingBox();
  const cy=touchBox.y+touchBox.height/2,cx=touchBox.x+touchBox.width/2;
  const touch=(x,id)=>({x,y:cy,id,radiusX:2,radiusY:2,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(cx-25,1),touch(cx+25,2)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(cx-65,1),touch(cx+65,2)]});
  await page.waitForFunction(()=>Number(document.querySelector('.security-price-interactive').dataset.chartCount)===54);
  const pinchCount=Number(await root.getAttribute('data-chart-count'));assert.ok(pinchCount<100,'two-finger pinch zooms chart');
  const pinchStart=Number(await root.getAttribute('data-chart-start'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(cx-40,1),touch(cx+90,2)]});
  await page.waitForFunction(start=>{const el=document.querySelector('.security-price-interactive');return Number(el.dataset.chartCount)===54&&Number(el.dataset.chartStart)<start},pinchStart);
  assert.ok(Number(await root.getAttribute('data-chart-start'))<pinchStart,'two fingers pan visible range');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await latest.innerText(),latestText);
  assert.equal(await chart.locator('[data-ma-period="120"]').isChecked(),true,'zoom keeps MA selection');
  await cdp.detach();
  await page.screenshot({path:`mobile-artifacts/build90/ma-${width}.png`,fullPage:true});
  await page.close();
 }}finally{await browser.close()}
 console.log('Build90: mobile 360/390/430 toggle isolation, default lines, insufficient data and overflow passed');
}
