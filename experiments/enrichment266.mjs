// New constrained-CPU enrichment/navigation hypothesis; synthetic intercepted traffic only.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_interaction_profile234.mjs','utf8');
s=s.replace('{rate:4}','{rate:Number(process.env.CPU_RATE||4)}');
s=s.replace("const file=resolve(root,'.'+url.pathname);","if(url.pathname==='/version.json')return json(route,{build:source.match(/var appBuild='([^']+)'/)[1]});const file=resolve(root,'.'+url.pathname);");
const a=s.indexOf('    const geometry='),b=s.indexOf('    assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);',a);
s=s.slice(0,a)+`const attempts=[];
for(const condition of (run%2?['pending','idle']:['idle','pending'])){
 await page.locator('#nav [data-tab="portfolio"]').click();await page.waitForFunction(()=>window.__dailyTest.state().idle);
 if(condition==='pending') {extraDelay=deferred();await page.locator('#refreshBtn').click();await waitGate(extraDelay,'enrichment');}
 calls.length=0;
 await page.evaluate(()=>{window.__renderSamples=[];window.__long=[];window.__obs=new PerformanceObserver(l=>window.__long.push(...l.getEntries().map(x=>x.duration)));window.__obs.observe({type:'longtask'});});
 const tabs=[];
 for(const tab of ['home','portfolio']){
 await page.evaluate(t=>{window.__start=performance.now();document.querySelector('#nav [data-tab="'+t+'"]').click()},tab);
 tabs.push({tab,ms:await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))))})
 }
 await page.evaluate(()=>{window.__start=performance.now();document.querySelector('.portfolio-list [data-security-id="daily-0"]').click()});await page.locator('#detailOverview').waitFor();
 const detailMs=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));
 if(extraDelay){extraDelay.release();extraDelay=null;}backgroundDelay.release();
 await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().background);
 assert.ok(await page.locator('#detailOverview').isVisible(),'late refresh keeps open detail');
 const hit=page.locator('.security-chart-hit');await hit.scrollIntoViewIfNeeded();
 const chartStart=performance.now();await hit.press('Home');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const chartMs=performance.now()-chartStart;
 const info=await page.evaluate(()=>{window.__obs.disconnect();return {renders:window.__renderSamples,longTasks:window.__long}});
 attempts.push({condition,tabs,detailMs,chartMs,requests:calls.length,...info});
 await page.locator('#detailReturn').click();await page.locator('#detailModal').waitFor({state:'hidden'});
}
samples.push({run:run+1,attempts});
`+s.slice(b);
s=s.slice(0,s.lastIndexOf('console.log(JSON.stringify('))+"console.log(JSON.stringify({cpuRate:Number(process.env.CPU_RATE||4),holdingCount,transportMs:50,conditions:'5 fresh sessions; alternated idle/pending enrichment; synthetic routes; 390x844; warmed tabs; callbacks not physical paint; chart keyboard event after drain',samples},null,2));";
const file='tests/.enrichment266-'+randomUUID()+'.mjs';try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file,'--profile-render'],{env:{...process.env,HOLDINGS:'50'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
