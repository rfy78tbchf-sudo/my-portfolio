import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const source=fs.readFileSync(process.env.PNL_SOURCE||'index.html','utf8');
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{const times=[];for(let i=0;i<7;i++){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const hook=`
 performanceAssetScope='stocks';session={accessToken:'synthetic'};kstDate=function(){return '2030-01-10'};live={stockPnl:null,accounts:[],holdings:[],securityMap:{}};
 window.calls=[];rpcNetwork=function(name,payload){calls.push(payload.p_period);return new Promise(function(resolve){setTimeout(function(){resolve({ok:true,period:payload.p_period,period_start:'2029-01-01',period_end:'2030-01-10',pnl_krw:17,complete:false,items:[],candidate_count:0,krw_included_count:0})},100)})};
 render=function(){document.body.innerHTML=stockPeriodPerformance()||''};
 window.run=async function(){var start=performance.now(),ps=[changeStockPeriod('1W')];await new Promise(function(r){setTimeout(r,10)});['1M','3M','6M','ALL'].forEach(function(p){ps.push(changeStockPeriod(p))});await Promise.all(ps);await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})});return {ms:performance.now()-start,calls:calls,period:live.stockPnl.period,complete:live.stockPnl.complete}};
 window.repeat=async function(){var n=calls.length;await changeStockPeriod('ALL');return calls.length-n};
 `;
 await page.route('**/*',r=>r.request().url()==='https://period.test/'?r.fulfill({contentType:'text/html',body:source.replace('  restoreLogin();',hook)}):r.abort());
 await page.goto('https://period.test/');const r=await page.evaluate(()=>window.run());times.push(r.ms);assert.equal(r.period,'ALL');assert.equal(r.complete,false);assert.match(await page.locator('.performance-hero').innerText(),/17원/);assert.equal(await page.evaluate(()=>window.repeat()),0);
 assert.equal(r.calls.length,process.env.PNL_BASELINE?5:2);await page.close();
 }times.sort((a,b)=>a-b);console.log(JSON.stringify({browser:name,runs:7,syntheticServiceMs:100,viewport:390,median:times[3],min:times[0],max:times[6],note:'real period renderer, request start through two animation frames; synthetic service, no CPU throttling'}));
 }finally{await browser.close()}
}
