import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let s=readFileSync('tests/refresh_critical_path253.mjs','utf8');
s=s.replace('extraDelayMs:1000,','');
s=s.replace(/  render=function\(preserve\).*?\n/,'');
s=s.replace('window.__dailyTest={',`window.__cacheSize=function(){return Object.keys(live.stockPnlCache||{}).length};window.__dailyTest={`);
const start=s.indexOf('    const samples=[];'),end=s.indexOf('    assert.deepEqual(forbidden,[]);',start);
s=s.slice(0,start)+`    const samples=[];const cdp=await context.newCDPSession(page);
    for(let cycle=0;cycle<21;cycle++){
      for(const period of ['1W','1M','3M','ALL']){
        await page.locator('[data-stock-period="'+period+'"]').click();await page.waitForFunction(p=>window.__dailyTest.state().period===p&&window.__dailyTest.state().idle,p=period);
      }
      if([0,10,20].includes(cycle)){
        await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');const cacheEntries=await page.evaluate(()=>window.__cacheSize());
        assert.ok(cacheEntries<=5);samples.push({cycle,cacheEntries,usedSize:heap.usedSize,totalRequests:calls.length,totalPnlRequests:calls.filter(c=>c.path.endsWith('/get_live_period_stock_pnl')).length});
      }
    }
    assert.equal(samples[1].totalPnlRequests,samples[2].totalPnlRequests,'warm navigation adds no stock-total requests');
`+s.slice(end);
s=s.replace('p=period','period');
const file='tests/.period-retention-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'50'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
