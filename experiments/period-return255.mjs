import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace('extraDelayMs:1000','supersededExtraDelayMs:300');
s=s.replace(/  render=function\(preserve\).*?\n/,'');
s=s.replace('window.__dailyTest.state().pnl===90000','window.__dailyTest.state().pnl!==null');
s=s.replace('window.__dailyTest={',`window.__returnProbe={
 reset:function(scope){performanceAssetScope=scope;live.stockPnlCache={};live.stockPnlCacheTimes={};live.stockPnl=null;live.stockRealized=null;live.stockRealizedPeriod=null;render(true)},
 state:function(){return {period:stockPeriod,pnl:live.stockPnl&&live.stockPnl.pnl_krw,loading:live.stockPnlLoading,complete:live.stockPnl&&live.stockPnl.complete}},
 mark:function(){window.__clickStart=performance.now()},result:function(){return performance.now()-window.__clickStart}
 };window.__dailyTest={`);
s=s.replace('calls.push({path,body});await',"calls.push({path,body});if(slow===body.p_period&&path.endsWith('/get_live_period_stock_pnl'))await new Promise(r=>setTimeout(r,300));await");
s=s.replace('stockResult(body.p_period,generation)',"stockResult(body.p_period,({'1W':1,'1M':2,'3M':3,'ALL':4}[body.p_period]||0))");
const begin=s.indexOf('    const samples=[];'),end=s.indexOf('    assert.deepEqual(forbidden,[]);',begin);if(begin<0||end<begin)throw Error('loop missing');
s=s.slice(0,begin)+`    const samples=[];
    for(const scope of ['stocks','all'])for(const target of ['1W','1M','3M','ALL'])for(let run=0;run<Number(process.env.RETURN_RUNS||5);run++){
      await page.evaluate(scope=>window.__returnProbe.reset(scope),scope);
      slow=target;const n=calls.length;await page.locator('[data-stock-period="'+target+'"]').click();
      await page.waitForFunction(()=>!window.__dailyTest.state().idle);
      while(!calls.slice(n).some(c=>c.path.endsWith('/get_live_period_stock_pnl')&&c.body.p_period===target))await new Promise(r=>setTimeout(r,5));
      await page.locator('[data-stock-period="'+(target==='1W'?'1M':'1W')+'"]').click();
      await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__returnProbe.state().loading);
      slow='none';const beforeCalls=calls.length;await page.evaluate(()=>window.__returnProbe.mark());
      await page.locator('[data-stock-period="'+target+'"]').click();
      const expected=90000+({'1W':1,'1M':2,'3M':3,'ALL':4}[target])*10000;
      await page.waitForFunction(([p,v])=>window.__returnProbe.state().period===p&&window.__returnProbe.state().pnl===v&&!window.__returnProbe.state().loading&&document.querySelector('.pnl-subtotal strong')?.textContent.includes(v.toLocaleString('en-US')),[target,expected]);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const ms=await page.evaluate(()=>window.__returnProbe.result());await page.waitForFunction(()=>window.__dailyTest.state().idle);
      assert.equal((await page.evaluate(()=>window.__returnProbe.state())).complete,false);
      const requests=calls.slice(beforeCalls).filter(c=>c.path.endsWith('/get_live_period_stock_pnl')).length;
      if(process.env.EXPECT_REUSE)assert.equal(requests,0);else assert.equal(requests,1);
      samples.push({scope,target,run,ms,requests});
    }
`+s.slice(end);
const file='tests/.period-return-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
