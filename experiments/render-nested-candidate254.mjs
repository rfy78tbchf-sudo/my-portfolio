import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
// Rejected prototype only: bypass the outer render tail after nested replacement.
const dir=mkdtempSync(join(tmpdir(),'render-candidate-'));
try{
 let source=readFileSync('index.html','utf8');
 const anchor='bindBrokerDay()}if(expanded)';
 if(source.split(anchor).length!==2)throw Error('Render anchor changed');
 source=source.replace('  function render(preserveScroll){','  var diagnosticRenderEpoch=0;\n  function render(preserveScroll){var diagnosticEpoch=++diagnosticRenderEpoch;');
 source=source.replace(anchor,'bindBrokerDay()}if(diagnosticEpoch!==diagnosticRenderEpoch)return;if(expanded)');
 const file=join(dir,'index.html');writeFileSync(file,source);
 process.stdout.write(execFileSync(process.execPath,['experiments/render-phases254.mjs'],{env:{...process.env,UI_SOURCE:file},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}));
}finally{rmSync(dir,{recursive:true,force:true})}
