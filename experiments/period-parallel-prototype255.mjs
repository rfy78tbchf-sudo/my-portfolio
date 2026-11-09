import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Counterfactual only. This removes server-protecting calculation serialization;
// it is NOT a deployment candidate and does not prove server-side cancellation.
const dir=mkdtempSync(join(tmpdir(),'period-parallel-'));
try{
 let s=readFileSync('index.html','utf8');
 const old='var result=stockCalculationTail.then(function(){';
 if(s.split(old).length!==2)throw Error('RPC anchor changed');
 s=s.replace(old,'var result=Promise.resolve().then(function(){');
 const file=join(dir,'index.html');writeFileSync(file,s);
 process.stdout.write(execFileSync(process.execPath,['experiments/period-delay255.mjs'],{env:{...process.env,UI_SOURCE:file},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}));
}finally{rmSync(dir,{recursive:true,force:true})}
