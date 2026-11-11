// Instrument the existing synthetic harness without duplicating its fixtures.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let source=readFileSync(new URL('./refresh_critical_path253.mjs',import.meta.url),'utf8');
source=source.replace('  window.__refreshTrace=[];',`  window.__swingTrace=[];
  var originalDiagnosticSwing=loadSwingPrices;
  loadSwingPrices=function(target){var start=performance.now();return originalDiagnosticSwing(target).finally(function(){window.__swingTrace.push({at:start,duration:performance.now()-start})})};
  window.__refreshTrace=[];`);
source=source.replace('window.__refreshTrace=[];window.__renderTrace=[];window.__refreshStart','window.__swingTrace=[];window.__refreshTrace=[];window.__renderTrace=[];window.__refreshStart');
source=source.replace('firstMs:window.__firstCorrect,','swing:window.__swingTrace.map(x=>({at:x.at-window.__refreshStart,duration:x.duration})),firstMs:window.__firstCorrect,');
source=source.replace('requests:calls.length-startCalls,',"swingRequests:calls.slice(startCalls).filter(c=>c.path.endsWith('/daily_security_prices')&&c.query?.includes('security_id=eq.')).length,requests:calls.length-startCalls,");
source=source.replace('calls.push({path,body});','calls.push({path,body,query:url.search});');
const file=new URL('./.refresh-swing-'+process.pid+'.mjs',import.meta.url);
try{writeFileSync(file,source,{flag:'wx'});process.stdout.write(execFileSync(process.execPath,[fileURLToPath(file)],{env:process.env,maxBuffer:10*1024*1024,stdio:['ignore','pipe','inherit']}));}finally{unlinkSync(file);}
