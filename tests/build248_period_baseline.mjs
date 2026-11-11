import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const source=fs.readFileSync(process.env.PNL_SOURCE||'index.html','utf8');
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.UI_BROWSER||n===process.env.UI_BROWSER)){
 const browser=await engine.launch({headless:true});
 try{const results=[];for(const period of ['1W','1M','3M','ALL'])for(const size of [10,100])for(let i=0;i<3;i++){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const hook=`
 session={accessToken:'synthetic'};kstDate=function(){return '2030-01-10'};live={stockPnl:null,accounts:[],holdings:[],securityMap:{}};
 window.calls=[];rpcNetwork=function(name,payload){calls.push(payload.p_period);return new Promise(function(resolve){setTimeout(function(){resolve({ok:true,period:payload.p_period,period_start:'2029-01-01',period_end:'2030-01-10',pnl_krw:17,complete:false,items:Array.from({length:${size}},function(_,i){return {symbol:'SYN'+i,name:'합성 종목 '+i,currency:'KRW',pnl_krw:null,reason:'원가 자료 부족'}}),candidate_count:${size},krw_included_count:0})},100)})};
 render=function(){document.body.innerHTML=stockPeriodPerformance()||''};
 window.run=async function(){var start=performance.now(),ps=[changeStockPeriod('${period}')];await Promise.all(ps);await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})});return {ms:performance.now()-start,calls:calls,period:live.stockPnl.period,complete:live.stockPnl.complete}};
 window.repeat=async function(){var n=calls.length;var start=performance.now();stockPeriod='OTHER';await changeStockPeriod('${period}');await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})});return {requests:calls.length-n,ms:performance.now()-start}};
 `;
 await page.route('**/*',r=>r.request().url()==='https://period.test/'?r.fulfill({contentType:'text/html',body:source.replace('  restoreLogin();',hook)}):r.abort());
 await page.goto('https://period.test/');const r=await page.evaluate(()=>window.run());assert.equal(r.period,period);assert.equal(r.complete,false);assert.match(await page.locator('.performance-hero').innerText(),/17원/);const warm=await page.evaluate(()=>window.repeat());assert.equal(warm.requests,0);results.push({period,size,first:r.ms,cached:warm.ms});
 assert.equal(r.calls.length,1);await page.close();
 }console.log(JSON.stringify({browser:name,syntheticServiceMs:100,viewport:390,results,note:'3 runs per period/output size; synthetic rendered rows, not transaction history or production network; cold page then same-snapshot cached return'}));
 }finally{await browser.close()}
}
