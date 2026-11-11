import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
export async function compareBrowser(db,base,candidate,cohort=null){
 const source=fs.readFileSync('index.html','utf8');
 if(!cohort)cohort={transactions:Number((await db.query('select count(*) n from transactions')).rows[0].n),positions:Number((await db.query('select count(distinct security_id) n from holdings')).rows[0].n)};
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
  const browser=await engine.launch({headless:true});const samples=[];
  try{for(const period of ['1W','1M','3M','ALL'])for(let run=0;run<Number(process.env.PERIOD_RUNS||3);run++)for(const kind of (run%2?['after','before']:['before','after'])){
   await db.exec('reset role');await db.exec(kind==='before'?base:candidate);await db.exec('set role authenticated');
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});let dbMs=0,requests=0,expected;
   const hook=`session={accessToken:'synthetic'};kstDate=function(){return '2026-11-09'};live={stockPnl:null,accounts:[],holdings:[],securityMap:{}};
    rpcNetwork=function(name,payload){return fetch('/rpc',{method:'POST',body:JSON.stringify(payload)}).then(function(r){return r.json()})};
    render=function(){document.body.innerHTML=stockPeriodPerformance()||''};
    window.run=async function(){var start=performance.now();await changeStockPeriod('${period}');await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})});return {ms:performance.now()-start,result:live.stockPnl,text:document.body.innerText}};
    window.repeat=async function(){stockPeriod='OTHER';return window.run()};`;
   await page.route('**/*',async route=>{
    if(route.request().url()==='https://period.test/')return route.fulfill({contentType:'text/html',body:source.replace('  restoreLogin();',hook)});
    if(route.request().url()==='https://period.test/rpc'){
     requests++;await new Promise(r=>setTimeout(r,100));const t=performance.now();
     expected=(await db.query('select public.get_live_period_stock_pnl($1) r',[JSON.parse(route.request().postData()).p_period])).rows[0].r;dbMs=performance.now()-t;
     return route.fulfill({contentType:'application/json',body:JSON.stringify(expected)});
    }return route.abort();
   });
   await page.goto('https://period.test/');const first=await page.evaluate(()=>window.run());assert.deepEqual(first.result,expected);assert.equal(first.result.period,period);assert.ok(first.text.length>0);assert.equal(requests,1);
   const warm=await page.evaluate(()=>window.repeat());assert.deepEqual(warm.result,expected);assert.equal(requests,1);
   samples.push({period,run,kind,firstMs:first.ms,dbMs,cachedMs:warm.ms});await page.close();
  }}finally{await browser.close();await db.exec('reset role')}
  console.log(JSON.stringify({browser:name,...cohort,viewport:390,syntheticTransportDelayMs:100,runs:Number(process.env.PERIOD_RUNS||3),samples}));
 }
}
