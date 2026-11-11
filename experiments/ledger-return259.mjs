// Actual browser loader/renderer plus local synthetic SQL. No production I/O.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=`import {createRealizedFixture} from './fixtures/realized257.mjs';
import {replaceLedger} from './fixtures/ledger259.mjs';
const db=await createRealizedFixture(Number(process.env.SECURITIES||1));
await replaceLedger(db,Number(process.env.SECURITIES||1),Number(process.env.TRANSACTIONS||3000));
const freeze=sql=>sql.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
await db.exec(freeze(readFileSync('supabase/build259_daily_realized_records.sql','utf8')).replace('public.get_live_realized_sales(','public.candidate_realized_sales('));
await db.exec('set role authenticated');
const expected={};for(const period of ['1W','1M','3M','ALL','THIS_MONTH'])expected[period]=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;
for(const p of Object.keys(expected))assert.deepEqual((await db.query('select candidate_realized_sales($1) r',[p])).rows[0].r,expected[p]);
let variant='baseline';const sqlTrace=[];
`+s;
s=s.replace('window.__dailyTest={',`kstDate=function(){return '2026-11-09'};
window.__realizedProbe={
 init:function(){performanceAssetScope='stocks';stockView='realized';render(true)},
 prepare:function(p){window.__refreshTrace=[];window.__renderTrace=[];window.__correctAt=null;
 var observer=new MutationObserver(function(){var node=document.querySelector('.performance-hero');
 if(live.stockRealized?.period===p&&!live.stockRealizedLoading&&node&&node.textContent.includes(live.stockRealized.period_start)){
 observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__correctAt=performance.now()}));
 }});observer.observe(document.querySelector('#content'),{childList:true,subtree:true});stockPeriod=p==='1W'?'1M':'1W';live.stockPnl=null;live.stockPnlPeriod=null;live.stockRealized=null;live.stockRealizedPeriod=null;live.stockRealizedLoading=false},
 result:function(){return live.stockRealized},
 value:function(){return stockRealizedRows(live.stockRealized).reduce(function(n,x){return n+(x.amount||0)},0)}
};window.__dailyTest={`);
s=s.replace("const rpc=path.split('/').pop();",`const rpc=path.split('/').pop();
if(rpc==='get_live_realized_sales'){
 const start=performance.now(),fn=variant==='baseline'?'get_live_realized_sales':'candidate_realized_sales';
 const result=(await db.query('select '+fn+'($1) r',[body.p_period])).rows[0].r;
 sqlTrace.push({variant,period:body.p_period,ms:performance.now()-start});
 assert.deepEqual(result,expected[body.p_period],'complete SQL output matches before delivery');
 return json(route,result);
}`);
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`    const samples=[];
page.setDefaultTimeout(60000);
await page.evaluate(()=>window.__realizedProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
for(const period of ['1W','1M','3M','ALL'])for(let run=0;run<Number(process.env.PAIRS||3);run++)for(const label of(run%2?['candidate','baseline']:['baseline','candidate'])){
 variant=label;await page.evaluate(p=>{window.__refreshTrace=[];window.__renderTrace=[];window.__correctAt=null;window.__realizedProbe.prepare(p)},period);
 const count=calls.length,sqlCount=sqlTrace.length,start=performance.now();
 await page.locator('[data-stock-period="'+period+'"]').click();
 await page.waitForFunction(p=>window.__dailyTest.state().idle&&window.__dailyTest.state().period===p&&window.__realizedProbe.result()?.period===p,period);
 await page.waitForFunction(()=>window.__correctAt!==null);
 const ms=performance.now()-start;
 assert.deepEqual(await page.evaluate(()=>window.__realizedProbe.result()),expected[period]);
 const amount=await page.evaluate(()=>window.__realizedProbe.value());
 assert.ok((await page.locator('.performance-hero .asset').innerText()).includes(amount.toLocaleString('en-US')+'원'),'correct rendered total');
 assert.equal(await page.locator('.performance-position').count(),Number(process.env.SECURITIES||1),'all securities rendered');
 const query=sqlTrace.slice(sqlCount);assert.equal(query.length,1);
 const stages=await page.evaluate(()=>{var r=window.__refreshTrace.find(x=>x.name==='get_live_realized_sales');return {requestToPaintMs:window.__correctAt-r.requestedAt,queueMs:r.networkAt-r.requestedAt,rpcMs:r.resolvedAt-r.networkAt,responseToPaintMs:window.__correctAt-r.resolvedAt,renderMs:window.__renderTrace.reduce((n,x)=>n+x.duration,0)}});
 const counts={realized:calls.slice(count).filter(c=>c.path.endsWith('/get_live_realized_sales')).length,total:calls.slice(count).filter(c=>c.path.endsWith('/get_live_period_stock_pnl')).length};
 assert.equal(counts.realized,1);samples.push({variant:label,period,run,ms,...stages,sqlMs:query[0].ms,requests:counts});
 console.error(JSON.stringify(samples.at(-1)));
}
// Verify the loaded result at every requested viewport and zoom.
for(const width of [390,402,430])for(const zoom of [1,1.25]){
 await page.setViewportSize({width,height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');
 assert.deepEqual(await page.evaluate(()=>window.__realizedProbe.result()),expected['ALL']);
}
`+s.slice(b);
s=s.replace('extraDelayMs:1000,','');
s=s.replace('samples}));','securities:Number(process.env.SECURITIES||1),transactions:Number(process.env.TRANSACTIONS||3000),sql:"local PGlite, actual realized and nested stock functions; NAV stubbed; stock result cache retained across return visits; realized remains uncached",samples}));');
s+='\nawait db.close();\n';
const file='tests/.realized-browser-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
