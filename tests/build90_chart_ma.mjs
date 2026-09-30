import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scope=vm.createContext({money:String,price:String,esc:String});
vm.runInContext(html.slice(html.indexOf('  function chartMovingAverages('),html.indexOf('  function heatmapHtml(')),scope);
const values=Array.from({length:140},(_,i)=>100+i);
const ma=scope.chartMovingAverages(values);
for(const s of ma){assert.equal(s.values[s.period-2],null);assert.equal(s.values[s.period-1],100+(s.period-1)/2);assert.equal(s.values[139],239-(s.period-1)/2)}
const modified=values.slice();modified[139]=999;
assert.deepEqual(Array.from(scope.chartMovingAverages(modified)[0].values.slice(0,139)),Array.from(ma[0].values.slice(0,139)),'no look-ahead');
for(const bad of [null,NaN,Infinity,'']){const data=values.slice();data[50]=bad;const result=scope.chartMovingAverages(data)[0];assert.equal(result.values[54],null);assert.equal(result.values[55],153)}
const points=values.map((close,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close,total_assets:close*100,source:i<70?'a':'b',currency:'USD'}));
assert.equal(scope.chartMovingAverages(values,points)[0].values[73],null);
assert.equal(scope.chartMovingAverages(values,points)[0].values[74],172);
for(const rendered of [scope.chart(values),scope.assetChart(points),scope.securityChart(points,'USD')]){assert.match(rendered,/data-ma-period="120"/);assert.match(rendered,/data-ma-line="20"/);assert.doesNotMatch(rendered,/NaN|Infinity/)}
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
  await page.setContent('<style>'+html.split('<style>')[1].split('</style>')[0]+'</style><main style="padding:14px"><section class="card"><h3>종목 가격</h3>'+scope.securityChart(data,'USD')+'</section><section class="card" style="margin-top:12px"><h3>자산 추이</h3>'+scope.assetChart(data)+'</section><section id="short" class="card">'+short+'</section></main>');
  const chart=page.locator('.ma-chart').first();
  assert.equal(await chart.locator('[data-ma-line="20"]').evaluate(el=>getComputedStyle(el).display),'block');
  await chart.locator('[data-ma-period="20"]').uncheck();
  assert.equal(await chart.locator('[data-ma-line="20"]').evaluate(el=>getComputedStyle(el).display),'none');
  await chart.locator('[data-ma-period="120"]').check();
  assert.equal(await chart.locator('[data-ma-line="120"]').evaluate(el=>getComputedStyle(el).display),'block');
  assert.equal(await page.locator('.ma-chart').nth(1).locator('[data-ma-period="20"]').isChecked(),true,'independent chart controls');
  assert.equal(await page.locator('#short input:disabled').count(),4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.screenshot({path:`mobile-artifacts/build90/ma-${width}.png`,fullPage:true});
  await page.close();
 }}finally{await browser.close()}
 console.log('Build90: mobile 360/390/430 toggle isolation, default lines, insufficient data and overflow passed');
}
