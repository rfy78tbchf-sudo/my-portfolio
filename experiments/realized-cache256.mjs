// Counterfactual TTL cache only. Not a deployment candidate: tests settlement freshness.
import {readFileSync,writeFileSync,unlinkSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let html=readFileSync('index.html','utf8');
const dir=mkdtempSync(join(tmpdir(),'realized-cache-'));
if(process.env.CANDIDATE){
 const anchor='    var previous=target.stockRealizedDay===day';
 if(!html.includes(anchor))throw Error('loader anchor drift');
 html=html.replace(anchor,`    var cache=target.experimentalRealizedCache||(target.experimentalRealizedCache={}),entry=cache[next];
    if(!force&&entry&&entry.day===day&&Date.now()-entry.at<30000){stockRealizedEpoch++;target.stockRealizedPeriod=next;target.stockRealizedDay=day;target.stockRealized=entry.value;target.stockRealizedLoading=false;target.stockRealizedFailed=false;target.stockRealizedPrevious=false;render(true);return true}
`+anchor);
 html=html.replace('      target.stockRealized=failed?previous:value;',`      if(!failed)cache[next]={day:day,at:Date.now(),value:value};
      target.stockRealized=failed?previous:value;`);
}
const ui=join(dir,'index.html');writeFileSync(ui,html);
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace(/  render=function\(preserve\).*?\n/,'');
s=s.replace('window.__dailyTest={',`window.__realizedProbe={
 init:function(){performanceAssetScope='stocks';stockView='realized';live.experimentalRealizedCache={};live.stockRealized=null;live.stockRealizedPeriod=null;render(true)},
 value:function(){return live.stockRealized&&(live.stockRealized.items[0]?.realized_local??live.stockRealized.items[0]?.average_cost_estimate?.realized_local)},
 force:function(){loadStockRealized(true)}
 };window.__dailyTest={`);
s=s.replace('get_live_realized_sales:{ok:true,items:[],period:body.p_period}',`get_live_realized_sales:{ok:true,items:[{symbol:'TEST',name:'Synthetic settlement',currency:'KRW',status:generation?'calculated':'settlement_pending',realized_local:generation?15:null,historical_krw_estimate:generation?15:null,net_proceeds:generation?115:117,quantity:1,fee:generation?1:null,tax:generation?1:null,allocated_cost:generation?100:null,average_cost_estimate:generation?undefined:{method:'prior_broker_average_reference',realized_local:17,reference_krw:17,allocated_cost:100,average_cost:100,costs_final:false}}],period:body.p_period}`);
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`    const samples=[];
    async function select(p){await page.locator('[data-stock-period="'+p+'"]').click();await page.waitForFunction(()=>window.__dailyTest.state().idle);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
    await page.evaluate(()=>window.__realizedProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
    for(const target of ['1W','1M','3M','ALL'])for(let run=0;run<5;run++){
      generation=0;await page.evaluate(()=>window.__realizedProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
      await select(target);await select(target==='1W'?'1M':'1W');
      const n=calls.length,t=performance.now();await select(target);const ms=performance.now()-t;
      assert.equal(await page.evaluate(()=>window.__realizedProbe.value()),17);
      samples.push({target,run,ms,realizedRequests:calls.slice(n).filter(c=>c.path.endsWith('/get_live_realized_sales')).length});
    }
    // Same live snapshot/day, provider settlement revision arrives inside TTL.
    generation=0;await page.evaluate(()=>window.__realizedProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
    await select('1M');await select('1W');generation=1;await select('1M');
    const observed=await page.evaluate(()=>window.__realizedProbe.value());
    const rendered=await page.locator('.performance-position').innerText();
    const revision={expected:15,observed,renderedMatchesObserved:rendered.includes(String(observed)),fresh:observed===15};
    assert.equal(revision.renderedMatchesObserved,true);
    if(process.env.CANDIDATE)assert.equal(revision.fresh,false,'TTL-only prototype must expose freshness loss');else assert.equal(revision.fresh,true);
    await page.evaluate(()=>window.__realizedProbe.force());await page.waitForFunction(()=>window.__dailyTest.state().idle);
    assert.equal(await page.evaluate(()=>window.__realizedProbe.value()),15,'forced fresh read recovers settlement revision');
    samples.push({revision});
`+s.slice(b);
s=s.replace('extraDelayMs:1000,','');
const file='tests/.realized-cache-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,UI_SOURCE:ui,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file);rmSync(dir,{recursive:true,force:true})}
