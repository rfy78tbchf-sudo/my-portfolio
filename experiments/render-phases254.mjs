import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let source=readFileSync('tests/refresh_critical_path253.mjs','utf8');
const anchor=`await page.locator('#nav [data-tab="performance"]').click();`;
if(!source.includes(anchor))throw Error('Missing scope anchor');
source=source.replace(anchor,anchor+`\n    if(await page.locator('[data-performance-scope="stocks"]').count())await page.locator('[data-performance-scope="stocks"]').click();`);
const hook=`
  window.__phaseTrace=[];
  ['contentInputActive','livePerformance','captureExpandedSections','homeTrendViewportAnchor','restoreExpandedSections','renderNav','bindPage','bindWealth','bindDrilldown','bindTradeTargets','bindDaily','bindPasskeyButtons','keepActivePeriodsVisible'].forEach(function(name){
    var original=eval(name);
    var wrapped=function(){var start=performance.now();try{return original.apply(this,arguments)}finally{window.__phaseTrace.push({name:name,at:start,duration:performance.now()-start})}};
    eval(name+'=wrapped');
  });
  var scrollDescriptor=Object.getOwnPropertyDescriptor(window,'scrollY');
  if(!scrollDescriptor||!scrollDescriptor.get||!scrollDescriptor.configurable)throw Error('scrollY instrumentation unsupported');
  Object.defineProperty(window,'scrollY',{...scrollDescriptor,get:function(){var start=performance.now();try{return scrollDescriptor.get.call(window)}finally{window.__phaseTrace.push({name:'scrollY',at:start,duration:performance.now()-start})}}});
  var originalScrollTo=window.scrollTo;window.scrollTo=function(){var start=performance.now();try{return originalScrollTo.apply(this,arguments)}finally{window.__phaseTrace.push({name:'scrollTo',at:start,duration:performance.now()-start})}};
  var innerDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{...innerDescriptor,set:function(value){var start=performance.now();try{return innerDescriptor.set.call(this,value)}finally{window.__phaseTrace.push({name:'innerHTML:'+this.id,at:start,duration:performance.now()-start})}}});
`;
source=source.replace('  window.__refreshTrace=[];',hook+'  window.__refreshTrace=[];');
source=source.replace('window.__renderTrace=[];', 'window.__renderCalls=[];window.__renderTrace=[];');
source=source.replace('var start=performance.now(),outer=diagnosticRenderDepth++===0;', 'var start=performance.now(),outer=diagnosticRenderDepth++===0;window.__renderCalls.push({at:start,depth:diagnosticRenderDepth,stack:new Error().stack});');
source=source.replace('firstMs:window.__firstCorrect,',`calls:window.__renderCalls.filter(x=>x.at>=window.__refreshStart),phases:window.__phaseTrace.filter(x=>x.at>=window.__refreshStart).map(x=>({...x,at:x.at-window.__refreshStart})),renderSpans:window.__renderTrace.map(x=>({at:x.at-window.__refreshStart,duration:x.duration})),firstMs:window.__firstCorrect,`);
const file='tests/.render-phases-'+randomUUID()+'.mjs';
try{writeFileSync(file,source,{flag:'wx'});process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,RUNS:process.env.RUNS||'5',PERIODS:process.env.PERIODS||'1W',CONDITIONS:process.env.CONDITIONS||'none',HOLDINGS:process.env.HOLDINGS||'50'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{try{unlinkSync(file)}catch(e){if(e.code!=='ENOENT')throw e}}
