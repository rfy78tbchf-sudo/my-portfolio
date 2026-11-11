import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('  function chartMovingAverages('),html.indexOf('  function heatmapHtml('));
const scope=vm.createContext({esc:String,price:(x,c)=>`${x} ${c}`,money:String});
vm.runInContext(code,scope);
const points=values=>values.map((close,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close,currency:'USD',source:'daily'}));
const flat=n=>Array(n).fill(100);
const run=values=>scope.dailyMaCrosses(points(values),'USD');
const down=[...flat(125),...Array(5).fill(90)];
const up=[...down,200];
for(const r of run(up)){
 assert.equal(r.event.kind,'golden');assert.equal(r.event.index,130);assert.equal(r.relation,1);
}
// Staying above is a state, not a newly emitted event.
for(const r of run([...up,200,200]))assert.equal(r.event.index,130);
const reversed=[...up,...Array(10).fill(10)];
for(const r of run(reversed)){assert.equal(r.event.kind,'dead');assert.equal(r.relation,-1)}
for(const r of run(flat(160))){assert.equal(r.event,null);assert.equal(r.relation,0)}
for(const r of run(Array.from({length:160},(_,i)=>100+i)))assert.equal(r.event,null,'initial above state is not a crossing');
assert.equal(run(flat(19))[0].ready,false);
assert.equal(run(flat(20))[0].ready,true);
assert.equal(run(flat(20))[1].ready,false);
// Exact tie after an established side: below -> equal -> above emits once;
// below -> equal -> below does not. Use sums independent of rolling accumulator.
const tieBase=[...flat(20),90];
for(const [value,expected] of [[99,null],[120,'golden']]){
 const r=run([...tieBase,110,value])[0];
 // First two changed closes sum to 200, making both averages equal.
 assert.equal(run([...tieBase,110])[0].relation,0);
 if(expected)assert.equal(r.event.kind,expected);else assert.equal(r.event,null);
}
// Invalid data or changed identity breaks history; old signals must not survive.
for(const bad of [null,'',0,-1,NaN,Infinity,'bad']){
 const data=points([...up,bad]);
 for(const r of scope.dailyMaCrosses(data,'USD')){assert.equal(r.ready,false);assert.equal(r.event,null)}
}
for(const patch of [{source:'other'},{currency:'KRW'},{date:'invalid'},{date:points(up).at(-2).date}]){
 const data=points(up);Object.assign(data.at(-1),patch);
 for(const r of scope.dailyMaCrosses(data,'USD'))assert.equal(r.event,null);
}
// Brute-force independent sliding windows across oscillating data.
const oscillating=Array.from({length:270},(_,i)=>150+25*Math.sin(i/11)+7*Math.cos(i/3));
for(const row of run(oscillating)){
 let side=0,event=null;
 const mean=(i,p)=>oscillating.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p;
 for(let i=row.period-1;i<oscillating.length;i++){
  const current=Math.sign(mean(i,5)-mean(i,row.period));
  if(side&&current&&side!==current)event={kind:current>0?'golden':'dead',index:i};
  if(current)side=current;
 }
 assert.equal(row.event.kind,event.kind);assert.equal(row.event.index,event.index);
}
const rendered=scope.dailyMaCrossHtml(points(up),'USD');
assert.match(rendered,/골든크로스/);assert.match(rendered,/최근 돌파/);assert.match(rendered,/5·120일/);
assert.doesNotMatch(rendered,/<details[^>]* open|NaN|Infinity/);
assert.match(scope.dailyMaCrossHtml(points(flat(3)),'USD'),/판정 대기/);
assert.match(scope.dailyMaCrossHtml(points(flat(130)),'USD'),/조회 구간 내 돌파 없음/);
assert.match(scope.dailyMaCrossHtml(points(flat(24)),'USD'),/일부 판정 대기/);
console.log('Build224: daily SMA golden/dead crossings, no repeated events, ties, history boundaries and independent oracle passed');
if(process.argv.includes('--browser')){
 const {chromium,webkit}=await import('playwright');
 fs.mkdirSync('mobile-artifacts/build224',{recursive:true});
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||process.env.UI_BROWSER===name)){
  const browser=await engine.launch({headless:true});
  try{for(const width of [390,402,430])for(const zoom of [1,1.25]){
   const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const data=points(up);
   await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+html.split('<style>')[1].split('</style>')[0]+'</style><main style="padding:16px;zoom:'+zoom+'"><section class="card"><h3>가격 차트</h3>'+scope.securityChart(data,'USD')+'</section></main>');
   const fontDir=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
   const fonts=fs.readdirSync(fontDir).filter(f=>f.endsWith('-400-normal.woff2'));
   await page.addStyleTag({content:fonts.map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fontDir)).toString('base64')})}`).join('')+'body{font-family:TestKorean,sans-serif}'});
   await page.evaluate(()=>document.fonts.ready);
   await page.addScriptTag({content:'var price=(v,c)=>v+" "+c;'+code});
   await page.evaluate(data=>bindSecurityChart(document.querySelector('.security-price-interactive'),data,'USD'),data);
   const summary=page.locator('.ma-cross-summary'),details=summary.locator('details');
   assert.equal(await details.getAttribute('open'),null);
   assert.equal(await summary.locator('.ma-cross-events .up').count(),3);
   const before=await summary.innerText();
   await page.locator('[data-chart-period="1"]').click();
   await page.locator('[data-chart-zoom="in"]').click();
   await page.locator('[data-ma-period="5"]').check();
   assert.equal(await summary.innerText(),before,'chart viewport and toggles cannot change the signal');
   await details.locator('summary').click();
   assert.equal(await summary.locator('.ma-cross-row').count(),3);
   assert.ok(await details.locator('summary').evaluate(e=>e.getBoundingClientRect().height>=44));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   for(const box of await summary.locator('*').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})))assert.ok(box.left>=0&&box.right<=width+1);
   await details.locator('summary').click();
   await page.screenshot({path:`mobile-artifacts/build224/${name}-${width}-${zoom}.png`,fullPage:true});
   assert.deepEqual(errors,[]);await page.close();
  }}finally{await browser.close()}
  console.log('Build224: '+name+' 390/402/430px at 100%/125%, disclosures, chart continuity and overflow passed');
 }
}
