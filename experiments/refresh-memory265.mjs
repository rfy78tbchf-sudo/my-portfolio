// Separate retained-heap diagnostic; timings include forced GC and are not latency results.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let g=readFileSync('experiments/manual-refresh265.mjs','utf8');
const patch=`
s=s.replace("const file=resolve(root,'.'+url.pathname);", "if(url.pathname==='/version.json')return json(route,{build:source.match(/var appBuild='([^']+)'/)[1]});const file=resolve(root,'.'+url.pathname);");
s=s.replace('const samples=[];', 'const heapSession=await context.newCDPSession(page);const samples=[];');
s=s.replace('console.error(p,run,scenario,Math.round(samples.at(-1).doneMs));', "await heapSession.send('HeapProfiler.collectGarbage');samples.at(-1).heap=await heapSession.send('Runtime.getHeapUsage');samples.at(-1).dom=await heapSession.send('Memory.getDOMCounters');console.error(p,run,scenario,JSON.stringify(samples.at(-1).heap));");
`;
g=g.replace("const file='tests/.manual265-'",patch+"\nconst file='tests/.manual265-'");
const file='experiments/.memory265-'+randomUUID()+'.mjs';try{writeFileSync(file,g);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,BROWSER:'chromium',PERIODS:'1M',RUNS:'10',SCENARIOS:'normal'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
