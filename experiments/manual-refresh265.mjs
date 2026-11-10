// Full button-driven foreground/background flow. Every response is synthetic.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace('window.__dailyTest={',`document.getElementById('refreshBtn').addEventListener('click',function(){if(window.__firstManualClick==null)window.__firstManualClick=performance.now()},true);var diagnosticMonths=recentHistoryMonths;window.__manualProbe={prepare:function(scenario){window.__firstManualClick=null;recentHistoryMonths=scenario==='failure'?function(){return ['2026-11','2026-10']}:diagnosticMonths;window.__refreshTrace=[];window.__renderTrace=[];window.__paints=[];window.__manualStart=performance.now();window.__lastPaintData=null;backgroundSyncTimes={};backgroundHistoryStarts={};if(window.__manualObserver)window.__manualObserver.disconnect();window.__manualObserver=new MutationObserver(function(){var data=live&&live.stockPnl,node=document.querySelector('.performance-hero .pnl-subtotal strong');if(data&&data!==window.__lastPaintData&&node&&node.textContent.includes(Number(data.pnl_krw).toLocaleString('en-US')+'원')){window.__lastPaintData=data;var revision=(data.pnl_krw-90000)/10000;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__paints.push({revision,ms:performance.now()-window.__manualStart})))}});window.__manualObserver.observe(document.querySelector('#content'),{subtree:true,childList:true})},done:function(){return !backgroundSyncPromise&&!liveRefreshPromise&&!liveLoadPromise&&!liveReadsActive&&!liveReadQueue.length}};window.__dailyTest={`);
s=s.replace('const calls=[],forbidden=[],errors=[];',"const edgeTrace=[];let condition='normal',historyIndex=0,firstHistory=null;const calls=[],forbidden=[],errors=[];");
s=s.replace("if(body.action==='sync-current')return json(route,{ok:true});",`if(body.action==='sync-current'){generation++;edgeTrace.push({action:body.action,at:performance.now(),revision:generation});return json(route,{ok:true})}`);
s=s.replace("if(body.action==='sync-history-month'||body.action==='sync-prices'){await backgroundDelay.wait;return json(route,{ok:true})}",`if(body.action==='sync-history-month'||body.action==='sync-prices'){
 const start=performance.now(),index=body.action==='sync-history-month'?historyIndex++:-1;if(index===0&&firstHistory)firstHistory.entered();
 if(index===0&&['slow','second'].includes(condition)||index===1&&condition==='failure')await new Promise(r=>setTimeout(r,1000));
 const failed=condition==='failure'&&index===1;
 if(!failed&&body.action==='sync-history-month')generation++;
 edgeTrace.push({action:body.action,month:body.month,start,at:performance.now(),revision:generation,failed});
 return json(route,failed?{message:'synthetic history unavailable'}:{ok:true},failed?503:200);
}`);
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`const samples=[];
 for(const p of (process.env.PERIODS||'1W,1M,3M,ALL').split(','))for(let run=0;run<Number(process.env.RUNS||3);run++)for(const scenario of (process.env.SCENARIOS||'normal,slow,failure,second').split(',')){
 condition='normal';generation=0;await page.evaluate(()=>window.__dailyTest.refresh());await page.evaluate(p=>window.__dailyTest.select(p),p);await page.waitForFunction(()=>window.__manualProbe.done());
 condition=scenario;historyIndex=0;firstHistory=deferred();const c=calls.length,e=edgeTrace.length,start=performance.now();await page.evaluate(scenario=>window.__manualProbe.prepare(scenario),scenario);
 await page.locator('#refreshBtn').click();
 if(scenario==='second'){await waitGate(firstHistory,'first background history');await page.waitForFunction(()=>!document.querySelector('#refreshBtn').disabled);await page.locator('#refreshBtn').click()}
 await page.waitForFunction(()=>window.__manualProbe.done(),null,{timeout:30000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=await page.evaluate(()=>window.__dailyTest.state()),paints=await page.evaluate(()=>window.__paints);
 assert.equal(state.pnl,90000+generation*10000,'latest successfully collected revision is displayed');
 assert.ok(paints.some(x=>x.revision===generation));
 const stages=await page.evaluate(()=>({clickOffsetMs:window.__firstManualClick-window.__manualStart,renderMs:window.__renderTrace.reduce((n,x)=>n+x.duration,0),rpc:window.__refreshTrace.filter(x=>x.name==='get_live_period_stock_pnl').map(x=>({start:x.requestedAt-window.__manualStart,queueMs:x.networkAt-x.requestedAt,rpcMs:x.resolvedAt-x.networkAt,responseAt:x.resolvedAt-window.__manualStart}))}));const edge=edgeTrace.slice(e);assert.equal(edge.filter(x=>x.action==='sync-current').length,scenario==='second'?2:1);
 if(scenario==='failure')assert.ok(edge.some(x=>x.failed)&&edge.some(x=>x.action==='sync-history-month'&&!x.failed),'one failed month cannot suppress other months');
 samples.push({p,run,scenario,doneMs:performance.now()-start,paints,...stages,finalRevision:generation,requests:calls.length-c,periodRequests:calls.slice(c).filter(x=>x.path.endsWith('/get_live_period_stock_pnl')).length,edge:edge.map(x=>({...x,start:x.start===undefined?undefined:x.start-start,at:x.at-start}))});console.error(p,run,scenario,Math.round(samples.at(-1).doneMs));
 }
`+s.slice(b);
const file='tests/.manual265-'+randomUUID()+'.mjs';try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
