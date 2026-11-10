// Current SQL regression with manual foreground/background orchestration.
// History responses are successful NO-CHANGE stubs; this is not a broker-write benchmark.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let g=readFileSync('experiments/refresh-current262.mjs','utf8');
const patch=`
s=s.replace("const file=resolve(root,'.'+url.pathname);", "if(url.pathname==='/version.json')return json(route,{build:source.match(/var appBuild='([^']+)'/)[1]});const file=resolve(root,'.'+url.pathname);");
s=s.replace('expected.ALL.stock',"expected[(process.env.PERIODS||'1W,1M,3M,ALL').split(',').at(-1)].stock");
s=s.replace("for(const period of ['1W','1M','3M','ALL'])","for(const period of (process.env.PERIODS||'1W,1M,3M,ALL').split(','))");
s=s.replace('refresh:function(){return refreshLive(true,false)}','refresh:function(){return refreshLive(true,true)}');
s=s.replace("if(body.action==='sync-history-month'||body.action==='sync-prices'){await backgroundDelay.wait;return json(route,{ok:true})}","if(body.action==='sync-history-month'||body.action==='sync-prices')return json(route,{ok:true});");
s=s.replace('window.__correctAt!==null&&window.__dailyTest.state().idle','window.__correctAt!==null&&window.__dailyTest.state().idle&&!window.__dailyTest.state().background');
s=s.replace('explicit refresh; expired current-read data;', 'manual broker flow; successful no-change history stubs; expired current-read data;');
`;
g=g.replace("const file='tests/.closed-browser-'",patch+"\nconst file='tests/.closed-browser-'");
const file='experiments/.current265-'+randomUUID()+'.mjs';try{writeFileSync(file,g);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,CONDITIONS:'none',SECURITIES:'1',TRANSACTIONS:'3000'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
