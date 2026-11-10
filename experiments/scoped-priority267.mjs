// Isolated foreground-only priority candidate; do not modify deployed application.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
const baseline=fs.readFileSync('index.html','utf8');let candidate=baseline;
const old='var job={task:task,resolve:resolve,reject:reject,owner:owner,priority:!!priority};\n      if(priority)liveReadQueue.unshift(job);else liveReadQueue.push(job);';
assert.equal(candidate.split(old).length,2);
candidate=candidate.replace(old,`var rank=priority===true?2:Number(priority)||0;
      var job={task:task,resolve:resolve,reject:reject,owner:owner,priority:rank};
      if(rank){var at=liveReadQueue.findIndex(function(x){return x.priority<rank||(rank===2&&x.priority===rank)});if(at<0)liveReadQueue.push(job);else liveReadQueue.splice(at,0,job)}else liveReadQueue.push(job);`);
const helper=`  function foregroundDetailRead(name,payload,active){return queueLiveRead(function(){if(!active())throw new Error('SUPERSEDED_READ');return rpcNetwork(name,payload)},1)}\n`;
candidate=candidate.replace('  function rpcNetwork(',helper+'  function rpcNetwork(');
const start=candidate.indexOf('    Promise.all([',candidate.indexOf('var request=++detailEpoch,detailOwner=')),end=candidate.indexOf('    ]).then(function(results)',start);
let block=candidate.slice(start,end);for(const name of ['get_live_security_detail','get_live_security_activity','get_investment_thesis','get_investment_decisions']){
 const re=new RegExp("rpc\\('"+name+"',([^\\n]*?)\\}\\)");assert.ok(re.test(block));block=block.replace(re,"foregroundDetailRead('"+name+"',$1},active)");
}
candidate=candidate.slice(0,start)+block+candidate.slice(end);
if(process.env.CANDIDATE_OUT)fs.writeFileSync(process.env.CANDIDATE_OUT,candidate);
function context(html){const order=[];let peak=0,active=0;const c=vm.createContext({Promise,setTimeout,liveAuthEpoch:1,session:{},rpcNetwork:async name=>{order.push(name);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,name==='get_detail_slow'?500:50));active--;return name}});vm.runInContext(html.slice(html.indexOf('  var liveReadQueue=[]'),html.indexOf('  function rpcNetwork(')),c);return {c,order,get peak(){return peak}}}
const samples=[];
for(const scenario of ['queued-pnl','new-pnl'])for(let pair=0;pair<3;pair++)for(const variant of pair%2?['candidate','baseline']:['baseline','candidate']){
 const x=context(variant==='candidate'?candidate:baseline),{c}=x;let release;const gate=new Promise(r=>release=r),jobs=Array.from({length:3},()=>c.queueLiveRead(()=>gate));
 const detail=(name)=>variant==='candidate'?c.foregroundDetailRead(name,{},()=>true):c.rpc(name,{});
 let elapsed;const start=performance.now();
 if(scenario==='queued-pnl'){
 jobs.push(c.rpc('get_live_period_stock_pnl',{}).then(()=>elapsed=performance.now()-start));await new Promise(r=>setImmediate(r));
 for(let i=0;i<4;i++)jobs.push(detail('get_detail'));
 release();
 }else{
 for(let i=0;i<3;i++)jobs.push(c.rpc('get_background',{}));for(let i=0;i<4;i++)jobs.push(detail('get_detail_slow'));
 release();await new Promise(r=>setTimeout(r,5));const selected=performance.now();jobs.push(c.rpc('get_live_period_stock_pnl',{}).then(()=>elapsed=performance.now()-selected));
 }
 await Promise.all(jobs);assert.ok(x.peak<=3);samples.push({scenario,pair,variant,pnlMs:elapsed,order:x.order,peak:x.peak});
}
const guards=[];
for(const mode of ['closed','owner']){const x=context(candidate),{c}=x;let release;const gate=new Promise(r=>release=r),jobs=Array.from({length:3},()=>c.queueLiveRead(()=>gate));let active=true;
 const pending=c.foregroundDetailRead('get_detail',{},()=>active).then(()=>{throw Error('obsolete request ran')},e=>e.message);
 if(mode==='closed')active=false;else c.liveAuthEpoch++;
 release();await Promise.all(jobs);const result=await pending;assert.equal(result,mode==='closed'?'SUPERSEDED_READ':'AUTH_REQUIRED');assert.equal(x.order.length,0);guards.push({mode,result,networkCalls:0});}
console.log(JSON.stringify({conditions:'Actual queue/rpc extracted into VM;3 occupied slots;50ms background/P&L and500ms slow-detail synthetic transport;3 alternating pairs/scenario; not hosted/browser latency',samples,guards},null,2));
