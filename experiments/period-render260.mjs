// Current Build260 render attribution; no before/after improvement claim.
// First correct period total and subsequent realized composition, all intercepted synthetic SQL.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=`import {createRealizedFixture} from './fixtures/realized257.mjs';
import {replaceLedger} from './fixtures/ledger259.mjs';
const db=await createRealizedFixture(Number(process.env.SECURITIES||100));
await replaceLedger(db,Number(process.env.SECURITIES||100),Number(process.env.TRANSACTIONS||3000));
const freeze=x=>x.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec(freeze(readFileSync('supabase/build260_closed_opening_quantity.sql','utf8')));
await db.exec(freeze(readFileSync('supabase/build260_closed_opening_quantity.sql','utf8')).replace('public.get_live_period_stock_pnl(','public.candidate_stock_pnl('));
const realized=freeze(readFileSync('supabase/build259_daily_realized_records.sql','utf8'));
await db.exec(realized);await db.exec(realized.replace('public.get_live_realized_sales(','public.candidate_realized_sales(').replace('public.get_live_period_stock_pnl(', 'public.candidate_stock_pnl('));
await db.exec('set role authenticated');
const expected={};for(const p of ['1W','1M','3M','ALL','THIS_MONTH']){
 expected[p]={stock:(await db.query('select get_live_period_stock_pnl($1) r',[p])).rows[0].r,realized:(await db.query('select get_live_realized_sales($1) r',[p])).rows[0].r};
 assert.deepEqual((await db.query('select candidate_stock_pnl($1) r',[p])).rows[0].r,expected[p].stock);
 assert.deepEqual((await db.query('select candidate_realized_sales($1) r',[p])).rows[0].r,expected[p].realized);
}
let variant='baseline';const sqlTrace=[];
`+s;
s=s.replace('window.__dailyTest={',`kstDate=function(){return '2026-11-09'};
window.__stockProbe={
 init:function(){performanceAssetScope='stocks';stockView='total';render(true)},
 prepare:function(p){window.__refreshTrace=[];window.__renderTrace=[];window.__longTasks=[];window.__correctAt=null;
 var observer=new MutationObserver(function(){var node=document.querySelector('.performance-hero .asset'),hero=document.querySelector('.performance-hero'),data=live.stockPnl;
 if(data?.period===p&&!live.stockPnlLoading&&hero&&hero.textContent.includes(data.period_start)&&(data.complete?node&&node.textContent.includes(Number(data.pnl_krw).toLocaleString('en-US')+'원'):/미계산|미확정/.test(hero.textContent))){
 observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__correctAt=performance.now()}));
 }});observer.observe(document.querySelector('#content'),{subtree:true,childList:true});
 stockPeriod=p==='1W'?'1M':'1W';live.stockPnlCache={};live.stockPnl=null;live.stockPnlLoading=false;live.stockRealized=null;live.stockRealizedPeriod=null;live.stockRealizedLoading=false},
 result:function(){return live.stockPnl},realized:function(){return live.stockRealized}
};window.__dailyTest={`);
s=s.replace("const rpc=path.split('/').pop();",`const rpc=path.split('/').pop();
if(['get_live_period_stock_pnl','get_live_realized_sales'].includes(rpc)){
 const kind=rpc==='get_live_realized_sales'?'realized':'stock';
 const fn=variant==='baseline'?rpc:(kind==='stock'?'candidate_stock_pnl':'candidate_realized_sales'),start=performance.now();
 const result=(await db.query('select '+fn+'($1) r',[body.p_period])).rows[0].r;
 sqlTrace.push({variant,kind,period:body.p_period,ms:performance.now()-start});
 if(expected[body.p_period])assert.deepEqual(result,expected[body.p_period][kind]);
 return json(route,result);
}`);
s=s.replace('&&window.__dailyTest.state().pnl===90000','&&window.__stockProbe.result()?.ok');
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`const samples=[];
 await page.evaluate(()=>{window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration})))).observe({type:'longtask'});window.__stockProbe.init()});await page.waitForFunction(()=>window.__dailyTest.state().idle);
 for(const period of ['1W','ALL'])for(let run=0;run<Number(process.env.PAIRS||3);run++)for(const label of['candidate']){
 variant=label;await page.evaluate(p=>window.__stockProbe.prepare(p),period);
 const q=sqlTrace.length,c=calls.length,start=performance.now();await page.locator('[data-stock-period="'+period+'"]').click();
 await page.waitForFunction(()=>window.__correctAt!==null&&window.__dailyTest.state().idle);
 const ms=performance.now()-start,stages=await page.evaluate(()=>{var r=window.__refreshTrace.find(x=>x.name==='get_live_period_stock_pnl');return {requestToPaintMs:window.__correctAt-r.requestedAt,queueMs:r.networkAt-r.requestedAt,rpcMs:r.resolvedAt-r.networkAt,responseToPaintMs:window.__correctAt-r.resolvedAt,renderMs:window.__renderTrace.reduce((n,x)=>n+x.duration,0)}});
 assert.deepEqual(await page.evaluate(()=>window.__stockProbe.result()),expected[period].stock);
 assert.deepEqual(await page.evaluate(()=>window.__stockProbe.realized()),expected[period].realized);
 if(expected[period].stock.complete)assert.ok((await page.locator('.performance-hero .asset').first().innerText()).includes(Number(expected[period].stock.pnl_krw).toLocaleString('en-US')+'원'));
 else assert.match(await page.locator('.performance-hero').first().innerText(),/미계산|미확정/,'unknown remains explicitly unknown');
 const rendering=await page.evaluate(()=>({longTasks:window.__longTasks,domNodes:document.querySelectorAll('*').length,renders:window.__renderTrace}));const payloadBytes=Buffer.byteLength(JSON.stringify(expected[period])); const sql=sqlTrace.slice(q),requests=calls.slice(c).filter(x=>['get_live_period_stock_pnl','get_live_realized_sales'].some(n=>x.path.endsWith('/'+n))).length;
 assert.equal(requests,2);assert.equal(sql.length,2);samples.push({variant:label,period,run,ms,...stages,sql,requests,rendering,payloadBytes});console.error(JSON.stringify(samples.at(-1)));
 }
 for(const width of [390,402,430])for(const zoom of [1,1.25]){
 await page.setViewportSize({width,height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 assert.deepEqual(await page.evaluate(()=>window.__stockProbe.result()),expected.ALL.stock);
 }
`+s.slice(b);
s=s.replace('extraDelayMs:1000,','');s=s.replace('samples}));','securities:Number(process.env.SECURITIES||100),transactions:Number(process.env.TRANSACTIONS||3000),sql:"local actual stock and realized functions; NAV stubbed; both plans warm; application caches cleared",samples}));');
s+='\nawait db.close();\n';
const file='tests/.closed-browser-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
