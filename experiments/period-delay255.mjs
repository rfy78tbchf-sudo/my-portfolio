import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace(/  render=function\(preserve\).*?\n/,'');
s=s.replace('window.__dailyTest.state().pnl===90000','window.__dailyTest.state().pnl!==null');
s=s.replace('var entry={name:name,requestedAt:', 'var entry={name:name,period:payload&&payload.p_period,requestedAt:');
s=s.replace('window.__dailyTest={',`window.__delayProbe={
 reset:function(scope){performanceAssetScope=scope;live.stockPnlCache={};live.stockPnlCacheTimes={};live.stockPnl=null;live.stockRealized=null;live.stockRealizedPeriod=null;render(true);window.__refreshTrace=[];},
 state:function(){return {period:stockPeriod,pnl:live.stockPnl&&live.stockPnl.pnl_krw,loading:live.stockPnlLoading,complete:live.stockPnl&&live.stockPnl.complete}},
 expire:function(p){live.stockPnlFetchedAt=Date.now()-31000;live.stockPnlCacheTimes[p]=Date.now()-31000},
 mark:function(){window.__clickStart=performance.now()},
 result:function(){return {ms:performance.now()-window.__clickStart,trace:window.__refreshTrace.map(x=>({name:x.name,period:x.period,queueMs:x.networkAt-x.requestedAt,responseMs:x.resolvedAt-x.networkAt}))}}
 };window.__dailyTest={`);
s=s.replace("const expected=90000+generation*10000;", "const expected=90000+generation*10000;");
s=s.replace("calls.push({path,body});await", "calls.push({path,body});if(slow===body.p_period&&path.endsWith('/get_live_period_stock_pnl'))await new Promise(r=>setTimeout(r,600));await");
s=s.replace('stockResult(body.p_period,generation)',"stockResult(body.p_period,({'1W':1,'1M':2,'3M':3,'ALL':4}[body.p_period]||0))");
const begin=s.indexOf('    const samples=[];'),end=s.indexOf('    assert.deepEqual(forbidden,[]);',begin);if(begin<0||end<begin)throw Error('loop missing');
s=s.slice(0,begin)+`    const samples=[];
    for(const scope of ['stocks','all'])for(const target of ['1W','1M','3M','ALL'])for(let run=0;run<5;run++){
      await page.evaluate(scope=>window.__delayProbe.reset(scope),scope);
      const old=target==='1W'?'1M':'1W';slow=old;const n=calls.length;
      await page.locator('[data-stock-period="'+old+'"]').click();
      // The old request is in flight before the newer user input, not just queued.
      while(!calls.slice(n).some(c=>c.path.endsWith('/get_live_period_stock_pnl')&&c.body.p_period===old))await new Promise(r=>setTimeout(r,5));
      await page.waitForTimeout(40);await page.evaluate(()=>window.__delayProbe.mark());
      await page.locator('[data-stock-period="'+target+'"]').click();
      const expected=90000+({'1W':1,'1M':2,'3M':3,'ALL':4}[target])*10000;
      await page.waitForFunction(([p,v])=>window.__delayProbe.state().period===p&&window.__delayProbe.state().pnl===v&&!window.__delayProbe.state().loading&&document.querySelector('.pnl-subtotal strong')?.textContent.includes(v.toLocaleString('en-US')),[target,expected]);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const result=await page.evaluate(()=>window.__delayProbe.result());
      await page.waitForFunction(()=>window.__dailyTest.state().idle);assert.equal((await page.evaluate(()=>window.__delayProbe.state())).pnl,expected);
      assert.equal((await page.evaluate(()=>window.__delayProbe.state())).complete,false);
      const totalCalls=calls.slice(n).filter(c=>c.path.endsWith('/get_live_period_stock_pnl'));assert.equal(totalCalls.length,2);
      slow='none';let beforeCalls=calls.length;
      await page.locator('[data-stock-period="'+target+'"]').click();await page.waitForFunction(()=>window.__dailyTest.state().idle);
      assert.equal(calls.slice(beforeCalls).filter(c=>c.path.endsWith('/get_live_period_stock_pnl')).length,0);
      await page.evaluate(p=>window.__delayProbe.expire(p),target);beforeCalls=calls.length;
      await page.locator('[data-stock-period="'+target+'"]').click();await page.waitForFunction(()=>window.__dailyTest.state().idle);
      assert.equal(calls.slice(beforeCalls).filter(c=>c.path.endsWith('/get_live_period_stock_pnl')).length,1);
      samples.push({scope,target,run,...result,totalRequests:2});
    }
`+s.slice(end);
const file='tests/.period-delay-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
