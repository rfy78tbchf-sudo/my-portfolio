// Follow-up on running old realized SQL blocking the newest selected period.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let s=readFileSync('experiments/ledger-browser259.mjs','utf8');
s=s.replace(' init:function(){',` rapid:function(){
   window.__rapidRequested=null;window.__rapidPaint=null;window.__refreshTrace=[];
   var observer=new MutationObserver(function(){
    var node=document.querySelector('.performance-hero');
    if(window.__rapidRequested&&live.stockRealizedPeriod==='1W'&&!live.stockRealizedLoading&&live.stockRealized?.period==='1W'&&node&&node.textContent.includes(live.stockRealized.period_start)){
      observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__rapidPaint=performance.now()-window.__rapidRequested}));
    }
   });observer.observe(document.querySelector('#content'),{childList:true,subtree:true});
   loadStockRealized(true);
   setTimeout(()=>{window.__rapidRequested=performance.now();document.querySelector('[data-stock-period="1W"]').click()},150);
},\n init:function(){`);
const start=s.indexOf("for(const period of ['1W','1M','3M','ALL'])for(let run="),end=s.indexOf('`+s.slice(b);',start);
if(start<0||end<0)throw Error('browser experiment anchor drift');
s=s.slice(0,start)+`for(let run=0;run<3;run++)for(const label of(run%2?['candidate','baseline']:['baseline','candidate'])){
 variant=label;
 await page.locator('[data-stock-period="ALL"]').click();await page.waitForFunction(()=>window.__dailyTest.state().idle);
 const queryStart=sqlTrace.length;
 await page.evaluate(()=>window.__realizedProbe.rapid());
 await page.waitForFunction(()=>window.__rapidPaint!==null&&window.__dailyTest.state().idle);
 assert.deepEqual(await page.evaluate(()=>window.__realizedProbe.result()),expected['1W']);
 const metrics=await page.evaluate(()=>({ms:window.__rapidPaint,trace:window.__refreshTrace.map(x=>({name:x.name,requestedMs:x.requestedAt-window.__rapidRequested,networkMs:x.networkAt-window.__rapidRequested,resolvedMs:x.resolvedAt-window.__rapidRequested}))}));
 const queries=sqlTrace.slice(queryStart);assert.deepEqual(queries.map(x=>x.period),['ALL','1W']);
 const old=metrics.trace.find(x=>x.name==='get_live_realized_sales');assert.ok(old.networkMs<0&&old.resolvedMs>0,'old realized request spans newest input');
 const amount=await page.evaluate(()=>window.__realizedProbe.value());assert.ok((await page.locator('.performance-hero .asset').innerText()).includes(amount.toLocaleString('en-US')+'원'));
 samples.push({variant:label,run,...metrics,sql:queries});console.error(JSON.stringify({variant:label,run,ms:metrics.ms}));
}
`+s.slice(end);
const file='experiments/.realized-rapid-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:process.env,maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
