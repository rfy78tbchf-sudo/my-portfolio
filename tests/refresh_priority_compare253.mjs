import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const baseline='/tmp/portfolio-refresh-before253.html';
writeFileSync(baseline,execFileSync('git',['show','e40184641247db15abbca21e9e31b92adb20b7bd:index.html']));
const output=[];
for(const browser of ['chromium','webkit']){
 const samples=[];
 for(let run=0;run<5;run++)for(const version of run%2?['after','before']:['before','after']){
  const result=JSON.parse(execFileSync(process.execPath,['tests/refresh_critical_path253.mjs'],{env:{...process.env,BROWSER:browser,HOLDINGS:'50',RUNS:'1',CONDITIONS:'none,reviews',UI_SOURCE:version==='before'?baseline:'index.html'},maxBuffer:10*1024*1024,stdio:['ignore','pipe','inherit']}));
  for(const sample of result.samples){assert.equal(sample.pnlRequests,1);assert.equal(sample.requests,98);samples.push({...sample,run,version});}
 }
 const median=xs=>xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)];
 const summary=[];
 for(const period of ['1W','1M','3M','ALL'])for(const condition of ['none','reviews']){
  const row={period,condition};
  for(const version of ['before','after']){
   const selected=samples.filter(s=>s.period===period&&s.condition===condition&&s.version===version),values=selected.map(s=>s.paintMs);
   assert.equal(selected.length,5);row[version]={median:median(values),min:Math.min(...values),max:Math.max(...values),samples:values};
  }
  if(condition==='reviews')assert.ok(row.after.median<row.before.median*0.75,'selected total bypasses delayed home reads');
  summary.push(row);
 }
 output.push({browser,summary,samples});console.log(JSON.stringify({browser,summary}));
}
mkdirSync('mobile-artifacts/refresh253',{recursive:true});writeFileSync('mobile-artifacts/refresh253/comparison.json',JSON.stringify(output,null,2));
