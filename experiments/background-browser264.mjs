import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace('window.__dailyTest={',`window.__overlap={begin:function(){window.__accountDone=false;loadLive(false).then(()=>window.__accountDone=true)},collect:function(){window.__backgroundDone=false;completeBackgroundSync(true,Date.now()).then(()=>window.__backgroundDone=true)}};window.__dailyTest={`);
s=s.replace("const calls=[],forbidden=[],errors=[];", "const backgroundReady=deferred();let finalRevision=0;const calls=[],forbidden=[],errors=[];");
s=s.replace("if(body.action==='sync-history-month'||body.action==='sync-prices'){await backgroundDelay.wait;return json(route,{ok:true})}","if(body.action==='sync-history-month'){generation++;return json(route,{ok:true})}if(body.action==='sync-prices'){finalRevision=generation;backgroundReady.entered();return json(route,{ok:true})}");
s=s.replace("if(rpc==='get_live_period_stock_pnl'){if(pnlDelay)","if(rpc==='get_live_period_stock_pnl'){const capturedGeneration=generation;if(pnlDelay)");
s=s.replace('stockResult(body.p_period,generation))','stockResult(body.p_period,capturedGeneration))');
const a=s.indexOf('    const samples=[];'),b=s.indexOf('    assert.deepEqual(forbidden,[]);',a);
s=s.slice(0,a)+`const samples=[];
 const beforeCalls=calls.length;const started=performance.now();pnlDelay=deferred();
 await page.evaluate(()=>window.__overlap.begin());await waitGate(pnlDelay,'held old period');
 await page.evaluate(()=>window.__overlap.collect());await waitGate(backgroundReady,'background completion');
 const held=pnlDelay;pnlDelay=null;held.release();
 await page.waitForFunction(()=>window.__backgroundDone&&window.__accountDone&&window.__dailyTest.state().idle);
 const expected=90000+finalRevision*10000;
 const state=await page.evaluate(()=>window.__dailyTest.state());
 const wanted=process.env.EXPECT_STALE==='1'?90000:expected;assert.equal(state.pnl,wanted,'expected collected revision through actual renderer');
 assert.ok((await page.locator('.performance-hero .pnl-subtotal strong').innerText()).includes(wanted.toLocaleString('en-US')+'원'));
 for(const width of [390,402,430])for(const zoom of [1,1.25]){await page.setViewportSize({width,height:844});await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 samples.push({scenario:'history completes during held old-period response',ms:performance.now()-started,finalRevision,displayedRevision:(state.pnl-90000)/10000,requests:calls.length-beforeCalls,periodRequests:calls.slice(beforeCalls).filter(x=>x.path.endsWith('/get_live_period_stock_pnl')).length});
`+s.slice(b);
const file='tests/.background264-'+randomUUID()+'.mjs';try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:10000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
