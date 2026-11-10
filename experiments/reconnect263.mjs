// Reuse the current SQL/browser fixture without changing production source.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let generator=readFileSync('experiments/refresh-current262.mjs','utf8');
const patch=String.raw`
s=s.replace('window.__stockProbe={',\`window.__resumeProbe={
 previous:null,
 prepare:function(age,expired){lastLiveLoadAt=Date.now()-age;this.previous=live.stockPnl;if(expired)session.expiresAt=Date.now()-1},
 start:function(){window.__refreshStart=performance.now();window.__resumeDone=null;var a=resumeLiveView(),b=resumeLiveView(),c=resumeLiveView();window.__sameResume=a===b&&b===c;return a.then(function(){window.__resumeDone=performance.now()-window.__refreshStart})},
 unchanged:function(){return live.stockPnl===this.previous}
};window.__stockProbe={\`);
s=s.replace("if(path==='/auth/v1/token')return json", "if(path==='/auth/v1/token'){authCalls++;await new Promise(r=>setTimeout(r,50));return json");
s=s.replace("expires_in:3600});", "expires_in:3600})};");
s=s.replace('const calls=[],forbidden=[],errors=[];', 'let authCalls=0;const calls=[],forbidden=[],errors=[];');
const start=s.indexOf('const samples=[];'),end=s.indexOf(' for(const width of [390,402,430])',start);
if(start<0||end<start)throw Error('fixture markers changed');
s=s.slice(0,start)+\`const samples=[];
 await page.evaluate(()=>window.__stockProbe.init());await page.waitForFunction(()=>window.__dailyTest.state().idle);
 for(const period of ['1W','1M','3M','ALL'])for(let run=0;run<Number(process.env.PAIRS||3);run++)for(const condition of ['warm','expired-data','expired-auth-and-data']){
  slow='none';variant='candidate';await page.evaluate(p=>window.__dailyTest.select(p),period);await page.waitForFunction(()=>window.__dailyTest.state().idle);
  await page.evaluate(({p,condition})=>{if(condition==='warm'){window.__correctAt=null;window.__refreshTrace=[];window.__renderTrace=[]}else window.__stockProbe.prepare(p);window.__resumeProbe.prepare(condition==='warm'?1000:240000,condition==='expired-auth-and-data')},{p:period,condition});
  const q=sqlTrace.length,c=calls.length,auth=authCalls;
  await page.evaluate(()=>window.__resumeProbe.start());
  await page.waitForFunction(()=>window.__dailyTest.state().idle);
  if(condition!=='warm')await page.waitForFunction(()=>window.__correctAt!==null);
  const metric=await page.evaluate(()=>({resumeDoneMs:window.__resumeDone,correctPaintMs:window.__correctAt===null?null:window.__correctAt-window.__refreshStart,samePromise:window.__sameResume,unchanged:window.__resumeProbe.unchanged(),renders:window.__renderTrace.length,renderMs:window.__renderTrace.reduce((n,x)=>n+x.duration,0)}));
  assert.equal(metric.samePromise,true,'three simultaneous return events share one resume');
  const rpcCount=calls.slice(c).filter(x=>['get_live_period_stock_pnl','get_live_realized_sales'].some(n=>x.path.endsWith('/'+n))).length;
  assert.equal(metric.unchanged,condition==='warm');assert.equal(rpcCount,condition==='warm'?0:2);
  assert.equal(authCalls-auth,condition==='expired-auth-and-data'?1:0);
  if(condition==='warm'){assert.equal(calls.length-c,0);assert.equal(metric.renders,0)}
  assert.deepEqual(await page.evaluate(()=>window.__stockProbe.result()),expected[period].stock);
  assert.deepEqual(await page.evaluate(()=>window.__stockProbe.realized()),expected[period].realized);
  samples.push({period,run,condition,...metric,requests:calls.length-c,periodRequests:rpcCount,authRequests:authCalls-auth,sql:sqlTrace.slice(q)});
  console.error(JSON.stringify(samples.at(-1)));
 }
\`+s.slice(end);
s=s.replace('explicit refresh; expired current-read data;', 'three concurrent resume calls; warm or expired session/data;');
`;
// Unescape only delimiter backticks used to embed the generator patch.
generator=generator.replace("const file='tests/.closed-browser-'",patch.replaceAll('\\`','`')+"\nconst file='tests/.closed-browser-'");
const file='experiments/.reconnect263-'+randomUUID()+'.mjs';
try{writeFileSync(file,generator);process.stdout.write(execFileSync(process.execPath,[file],{env:process.env,maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
