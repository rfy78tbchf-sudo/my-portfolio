// Functional race check: real refresh button, late synthetic history, rapid period switches.
// All transport is intercepted; no production writes or broker requests.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let g=readFileSync('experiments/manual-refresh265.mjs','utf8');
const patch=`
s=s.replace("const file=resolve(root,'.'+url.pathname);", "if(url.pathname==='/version.json')return json(route,{build:source.match(/var appBuild='([^']+)'/)[1]});const file=resolve(root,'.'+url.pathname);");
s=s.replace('pnl:live&&live.stockPnl&&live.stockPnl.pnl_krw','dataPeriod:live&&live.stockPnl&&live.stockPnl.period,pnl:live&&live.stockPnl&&live.stockPnl.pnl_krw');
s=s.replace("await page.locator('#refreshBtn').click();", "await page.locator('#refreshBtn').click();await waitGate(firstHistory,'pending history before switch');await page.evaluate(()=>{window.__dailyTest.select('1W');window.__dailyTest.select('3M');window.__dailyTest.select('ALL')});");
s=s.replace("assert.equal(state.pnl,", "assert.equal(state.period,'ALL');assert.equal(state.dataPeriod,'ALL','late history cannot restore the old period');assert.equal(state.pnl,");
s=s.replace('samples.push({p,run,scenario,','samples.push({p,run,scenario,finalPeriod:state.period,dataPeriod:state.dataPeriod,');
`;
g=g.replace("const file='tests/.manual265-'",patch+"\nconst file='tests/.manual265-'");
const file='experiments/.switch265-'+randomUUID()+'.mjs';try{writeFileSync(file,g);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,PERIODS:'1M',RUNS:'3',SCENARIOS:'slow'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
