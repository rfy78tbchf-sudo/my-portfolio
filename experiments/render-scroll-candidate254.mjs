import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'render-scroll-'));
try{
 let source=readFileSync('index.html','utf8');
 const anchor='  function render(preserveScroll){';
 if(source.split(anchor).length!==2)throw Error('Render anchor changed');
 source=source.replace(anchor,`  var renderDepth254=0,renderScroll254=0;
  function render(preserveScroll){if(!renderDepth254)renderScroll254=preserveScroll===true?window.scrollY:0;renderDepth254++;try{return renderContent254(preserveScroll)}finally{renderDepth254--}}
  function renderContent254(preserveScroll){`);
 source=source.replace('var scrollY=preserveScroll===true?window.scrollY:0,expanded=', 'var scrollY=preserveScroll===true?renderScroll254:0,expanded=');
 const file=join(dir,'index.html');writeFileSync(file,source);
 process.stdout.write(execFileSync(process.execPath,['experiments/render-phases254.mjs'],{env:{...process.env,UI_SOURCE:file},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}));
}finally{rmSync(dir,{recursive:true,force:true})}
