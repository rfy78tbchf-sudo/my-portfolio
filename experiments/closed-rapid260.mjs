import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let s=readFileSync('experiments/closed-browser260.mjs','utf8');
const a=s.indexOf(" for(const period of ['1W','1M','3M','ALL'])for(let run="),b=s.indexOf(' for(const width of [390,402,430])',a);
if(a<0||b<0)throw Error('rapid harness anchor drift');
s=s.slice(0,a)+`for(let run=0;run<3;run++)for(const label of(run%2?['candidate','baseline']:['baseline','candidate'])){
 variant=label;await page.evaluate(()=>window.__stockProbe.prepare('1W'));const start=sqlTrace.length;
 await page.evaluate(()=>{window.__rapidRequested=null;window.__dailyTest.select('ALL');setTimeout(()=>{window.__rapidRequested=performance.now();window.__dailyTest.select('1W')},150)});
 await page.waitForFunction(()=>window.__correctAt!==null&&window.__dailyTest.state().idle);
 assert.deepEqual(await page.evaluate(()=>window.__stockProbe.result()),expected['1W'].stock);
 assert.deepEqual(await page.evaluate(()=>window.__stockProbe.realized()),expected['1W'].realized);
 const metrics=await page.evaluate(()=>({ms:window.__correctAt-window.__rapidRequested,trace:window.__refreshTrace.map(x=>({name:x.name,requestedMs:x.requestedAt-window.__rapidRequested,networkMs:x.networkAt-window.__rapidRequested,resolvedMs:x.resolvedAt-window.__rapidRequested}))}));
 const sql=sqlTrace.slice(start);assert.deepEqual(sql.map(x=>x.kind+':'+x.period),['stock:ALL','stock:1W','realized:1W']);
 const old=metrics.trace.find(x=>x.name==='get_live_period_stock_pnl');assert.ok(old.networkMs<0&&old.resolvedMs>0);
 samples.push({variant:label,run,...metrics,sql});console.error(JSON.stringify({variant:label,run,ms:metrics.ms}));
 }
`+s.slice(b);
s=s.replace("expected.ALL.stock);","expected['1W'].stock);");
const file='experiments/.closed-rapid-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:process.env,maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
