// Isolated candidate and explicit P&L scheduling regression, no app mutation.
import fs from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';import assert from 'node:assert/strict';
const baseline=fs.readFileSync('index.html','utf8'),old="},['get_live_period_stock_pnl','get_live_realized_sales'].indexOf(name)>=0);",next="},['get_live_period_stock_pnl','get_live_realized_sales','get_live_security_detail','get_live_security_activity','get_investment_thesis','get_investment_decisions'].indexOf(name)>=0);";
assert.equal(baseline.split(old).length,2);const candidate=baseline.replace(old,next);if(process.env.CANDIDATE_OUT)fs.writeFileSync(process.env.CANDIDATE_OUT,candidate);
const samples=[];
for(let pair=0;pair<5;pair++)for(const variant of pair%2?['candidate','baseline']:['baseline','candidate']){
 const html=variant==='baseline'?baseline:candidate;let release;const held=new Promise(r=>release=r),order=[];
 const c=vm.createContext({Promise,setTimeout,liveAuthEpoch:1,session:{},rpcNetwork:async name=>{order.push(name);await new Promise(r=>setTimeout(r,50));return name}});
 vm.runInContext(html.slice(html.indexOf('  var liveReadQueue=[]'),html.indexOf('  function rpcNetwork(')),c);
 const work=Array.from({length:3},()=>c.queueLiveRead(()=>held));
 let pnlMs;const start=performance.now();work.push(c.rpc('get_live_period_stock_pnl',{}).then(()=>pnlMs=performance.now()-start));
 // Allow the calculation-tail microtask to enqueue P&L before detail clicks arrive.
 await new Promise(r=>setImmediate(r));
 for(const n of ['get_live_security_detail','get_live_security_activity','get_investment_thesis','get_investment_decisions'])work.push(c.rpc(n,{}));
 release();await Promise.all(work);assert.equal(order.length,5);samples.push({pair,variant,pnlMs,order});
}
console.log(JSON.stringify({conditions:'VM actual scheduler,3 held active reads then queued P&L then4 detail reads;50ms synthetic network;5 alternating pairs; scheduling counterexample not browser/hosted SQL latency',samples},null,2));
