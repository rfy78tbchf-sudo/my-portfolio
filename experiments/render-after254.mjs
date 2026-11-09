import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
let source=readFileSync('tests/refresh_critical_path253.mjs','utf8');
const anchor="await page.locator('#nav [data-tab=\"performance\"]').click();";
if(!source.includes(anchor))throw Error('Missing performance entry');
source=source.replace(anchor,anchor+"\n    if(await page.locator('[data-performance-scope=\"stocks\"]').count())await page.locator('[data-performance-scope=\"stocks\"]').click();");
source=source.replace('firstMs:window.__firstCorrect,','renderSpans:window.__renderTrace.map(x=>({at:x.at-window.__refreshStart,duration:x.duration})),firstMs:window.__firstCorrect,');
const file='tests/.render-after254-'+process.pid+'.mjs';
try{writeFileSync(file,source,{flag:'wx'});process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,RUNS:'5',PERIODS:'1W',CONDITIONS:'none',HOLDINGS:'50'},maxBuffer:10000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
