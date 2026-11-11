import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
// Synthetic amounts only. Build244 keeps the first-year basis checks and replaces rolling forecasts with a fixed goal path.
const data={ok:true,today:'2026-10-31',plan:{base_amount:100000000,base_date:'2026-10-28',std_rate:20,best_rate:30},current:{amount:110000000},records:[]};
const scope=vm.createContext({liveAuthEpoch:1,kstDate:()=>data.today,mode:'live',live:null,esc:String,cls:n=>n<0?'down':'up',money:n=>Number(n).toLocaleString('en-US')+'원',signedMoney:n=>(n>0?'+':'')+Number(n).toLocaleString('en-US')+'원',pct:n=>Number(n).toFixed(2)+'%',num:(n,d)=>Number(n).toFixed(d),shortGoal:n=>n/1e8+'억',kstStamp:String});
vm.runInContext(html.slice(html.indexOf('  var wealthOwner='),html.indexOf('  function legacyAnalysis(')),scope);
const goal=Math.round(100000000*1.2**(64/365.2425));
const forecast=Math.round(110000000*1.2**(61/365.2425));
assert.equal(scope.wealthMetrics(data).scenarios[0].target,goal);
assert.equal(scope.wealthProjection(110000000,20,data.today,'2026-12-31'),forecast);
assert.notEqual(goal,forecast);
assert.equal(scope.wealthMetrics({...data,today:'2026-11-01',current:{amount:120000000}}).scenarios[0].target,goal,'refresh and calendar advance must not move fixed goal');
scope.wealthState().data=data;
let panel=scope.wealthPanel();
for(const text of ['2026-10-28 시작','64일 반영','연도별 목표','올해 목표 고정','64 ÷ 365.2425','목표 증가액 달성'])assert.ok(panel.includes(text),text);
assert.ok(!panel.includes('올해 시작 100,000,000'),'midyear baseline must not imply January start');
assert.match(panel,/목표 계산 근거/);
// Annual server row remains authoritative; full years must not claim fractional compounding.
const later={...data,today:'2027-01-01',current_year:{start_date:'2027-01-01',base_amount:120000000,std_target:144000000,best_target:156000000}};
scope.wealthState().data=later;panel=scope.wealthPanel();
assert.match(panel,/올해 시작 120,000,000/);assert.match(panel,/2027-01-01 → 2027-12-31/);
assert.doesNotMatch(panel,/>64일 반영|64 ÷ 365.2425/);
scope.wealthState().data={...data,plan:{...data.plan,base_date:'2026-01-01'}};
assert.match(scope.wealthPanel(),/364 ÷ 365.2425/,'first plan year retains existing daily-compound convention even at January start');
scope.wealthState().data={...later,current_year:null};
assert.match(scope.wealthPanel(),/2027-01-01 → 2027-12-31/,'pending next-year goal must not display original-year date');
console.log('Fixed goal basis: amounts, dates, day counts, refresh stability and annual rollover passed');
if(process.argv.includes('--browser')){
 const {chromium,webkit}=await import('playwright');
 const hook=`kstDate=function(){return '2026-10-31'};window.__basis={calls:0,data:${JSON.stringify(data)}};rpc=function(name){window.__basis.calls++;return Promise.resolve(JSON.parse(JSON.stringify(window.__basis.data)))};resumeLiveView=function(){return Promise.resolve()};currentTab='analysis';live={holdings:[],securityMap:{},settings:{}};showApp('live');window.__basis.redraw=function(){wealthState().data=JSON.parse(JSON.stringify(window.__basis.data));render(true)};`;
 const source=html.replace('  restoreLogin();',hook);
 fs.mkdirSync('mobile-artifacts/build243',{recursive:true});
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.UI_BROWSER||name===process.env.UI_BROWSER)){
  const browser=await engine.launch({headless:true});
  try{for(const width of [390,402,430])for(const zoom of [1,1.25]){
   const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url()==='https://basis.test/'?r.fulfill({contentType:'text/html',body:source}):r.abort());await page.goto('https://basis.test/');
   const fonts=new URL('../node_modules/@fontsource/noto-sans-kr/files/',import.meta.url);
   await page.addStyleTag({content:fs.readdirSync(fonts).filter(f=>f.endsWith('-400-normal.woff2')).map(f=>`@font-face{font-family:TestKorean;src:url(data:font/woff2;base64,${fs.readFileSync(new URL(f,fonts)).toString('base64')})}`).join('')+`body{font-family:TestKorean,sans-serif;zoom:${zoom}}`});
   await page.locator('.wealth-total').waitFor();assert.match(await page.locator('.wealth-start-basis').innerText(),/2026-10-28 시작 100,000,000/);
   assert.equal((await page.locator('.wealth-target').first().innerText()).replace(/[^0-9]/g,''),String(goal));
   assert.match(await page.locator('.wealth-period-note').first().innerText(),/64일/);
   const details=page.locator('.wealth-goal-basis');assert.equal(await details.evaluate(e=>e.open),false);
   await details.locator('summary').tap();assert.match(await details.innerText(),/64 ÷ 365.2425/);
   assert.match(await page.locator('.wealth-forecast-basis').innerText(),/올해는 위 목표와 동일/);
   assert.match(await page.locator('.wealth-forecast-period').innerText(),/전년 말 확정 자산/);
   const predicted=page.locator('.wealth-future > .wealth-future-row').nth(1).locator('strong').first();
   assert.equal((await predicted.innerText()).replace(/[^0-9]/g,''),String(goal));
   assert.equal(await page.evaluate(()=>window.__basis.calls),1,'basis disclosure adds no request');
   assert.match(await page.locator('.wealth-goal-gap').first().innerText(),new RegExp((110000000-goal).toLocaleString('en-US')+'원\\s*초과 달성'));
   const curve=await page.locator('.wealth-future-chart').innerHTML();
   const clipped=await page.locator('.wealth-target,.wealth-goal-gap,.wealth-start-basis,.wealth-forecast-basis,.wealth-forecast-period,.wealth-future-row strong').evaluateAll(es=>es.some(e=>e.scrollWidth>e.clientWidth+1));assert.equal(clipped,false,`${name} ${width}/${zoom} clipped`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
   await details.locator('summary').tap();
   if(width===390)await page.screenshot({path:`mobile-artifacts/build243/${name}-${width}-${zoom}.png`,fullPage:true});
   await page.evaluate(()=>{window.__basis.data.today='2026-11-01';window.__basis.data.current.amount=120000000;window.__basis.redraw()});
   assert.equal((await page.locator('.wealth-target').first().innerText()).replace(/[^0-9]/g,''),String(goal));
   assert.equal((await predicted.innerText()).replace(/[^0-9]/g,''),String(goal));assert.match(await page.locator('.wealth-goal-gap').first().innerText(),new RegExp((120000000-goal).toLocaleString('en-US')+'원\\s*초과 달성'));
   assert.equal(await page.locator('.wealth-future-chart').innerHTML(),curve,'current asset changes never move the goal curve');
   await page.evaluate(()=>{window.__basis.data.current.amount=null;window.__basis.data.today='2027-01-01';window.__basis.data.current_year={base_amount:null,std_target:null,best_target:null,start_date:'2027-01-01'};window.__basis.redraw()});
   assert.equal(await page.locator('.wealth-target').first().innerText(),'전년 말 자산 확인 중');assert.equal(await predicted.innerText(),'—');
   await page.evaluate(()=>{window.__basis.data.current.amount=125000000;window.__basis.data.current_year={base_amount:125000000,std_target:150000000,best_target:162500000,start_date:'2027-01-01'};window.__basis.redraw()});
   assert.equal(await predicted.innerText(),'150,000,000원');assert.equal(await page.locator('.wealth-target').first().innerText(),'150,000,000원');
   assert.deepEqual(errors,[]);await page.close();console.log(name,width,zoom,'goal/forecast basis, fixed target, mobile amounts passed');
  }}finally{await browser.close()}
 }
}
