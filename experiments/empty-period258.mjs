// Full browser loader with real local SQL. External calls are intercepted synthetic fixtures.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=`import {createRealizedFixture} from './fixtures/realized257.mjs';
const db=await createRealizedFixture(3);
const freeze=sql=>sql.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const full=readFileSync('supabase/build254_existing_periods.sql','utf8');
const stock={baseline:full.slice(full.indexOf('CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl')),candidate:readFileSync('supabase/build258_empty_period_items.sql','utf8')};
await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
let variant='baseline';const sqlTrace=[];
`+s;
s=s.replace('window.__dailyTest={',`kstDate=function(){return '2026-11-09'};
window.__emptyProbe={
 init:function(){performanceAssetScope='stocks';stockView='realized';render(true)},
 prepare:function(){stockPeriod='1W';live.stockPnlCache={};live.stockPnl=null;live.stockPnlPeriod=null;live.stockRealized=null;live.stockRealizedPeriod=null;live.stockRealizedLoading=false},
 state:function(){return {data:live.stockRealized,loading:live.stockRealizedLoading,failed:live.stockRealizedFailed}}
};window.__dailyTest={`);
s=s.replace("const rpc=path.split('/').pop();",`const rpc=path.split('/').pop();
if(rpc==='get_live_realized_sales'){
 const start=performance.now();
 try{const result=(await db.query('select get_live_realized_sales($1) r',[body.p_period])).rows[0].r;
 sqlTrace.push({variant,period:body.p_period,ms:performance.now()-start,outcome:'result'});return json(route,result);
 }catch(e){assert.equal(e.code,'22023');sqlTrace.push({variant,period:body.p_period,ms:performance.now()-start,outcome:e.code});return json(route,{code:e.code,message:e.message},400)}
}`);
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`    const samples=[];
await page.evaluate(()=>window.__emptyProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
for(let run=0;run<Number(process.env.PAIRS||5);run++)for(const label of(run%2?['candidate','baseline']:['baseline','candidate'])){
 variant=label;await db.exec(freeze(stock[label]));
 // Warm SQL plans identically; these warm-ups are excluded from browser timings.
 try{await db.query("select get_live_realized_sales('TODAY')")}catch(e){assert.equal(label,'baseline');assert.equal(e.code,'22023')}
 await page.evaluate(()=>window.__emptyProbe.prepare());const count=calls.length,sqlCount=sqlTrace.length,start=performance.now();
 await page.evaluate(()=>window.__dailyTest.select('오늘'));
 await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__emptyProbe.state().loading);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const ms=performance.now()-start,state=await page.evaluate(()=>window.__emptyProbe.state());
 if(label==='baseline'){assert.equal(state.failed,true);assert.ok((await page.locator('#content').innerText()).includes('매도 손익을 불러오지 못했습니다.'))}
 else{assert.equal(state.data.ok,true);assert.deepEqual(state.data.items,[]);assert.equal(await page.locator('.performance-hero .asset').innerText(),'내역 없음');assert.equal(await page.locator('.performance-position').count(),0)}
 const query=sqlTrace.slice(sqlCount);assert.equal(query.length,1);
 samples.push({variant:label,run,ms,sqlMs:query[0].ms,outcome:label==='baseline'?'error_22023':'correct_empty_result',requests:calls.slice(count).filter(c=>c.path.endsWith('/get_live_realized_sales')).length});
}
// Same empty state at requested mobile widths/zoom; no layout/product modifications.
await db.exec(freeze(stock.candidate));await page.evaluate(()=>window.__emptyProbe.prepare());await page.evaluate(()=>window.__dailyTest.select('오늘'));await page.waitForFunction(()=>window.__dailyTest.state().idle);
for(const width of [390,402,430])for(const zoom of [1,1.25]){
 await page.setViewportSize({width,height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
 assert.equal(await page.locator('.performance-hero .asset').innerText(),'내역 없음');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');
}
`+s.slice(b);
s=s.replace('extraDelayMs:1000,','');
s+='\nawait db.close();\n';
const file='tests/.empty-period-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
