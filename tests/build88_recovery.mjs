import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const helper=html.slice(html.indexOf('  function opinionDeadline('),html.indexOf('  function fetchTimeout('));
const ctx={setTimeout,clearTimeout,Promise,SUPABASE_URL:'https://fixture.invalid',SUPABASE_KEY:'fixture',encodeURIComponent};
vm.createContext(ctx);vm.runInContext(helper,ctx);
const payload={request_id:'same-id',symbol:'MRNA'};
let reads=0,posts=0;
ctx.authFetch=async()=>{posts++;throw Error('Load failed')};
ctx.rest=async path=>{reads++;assert.match(path,/request_id=eq.same-id&symbol=eq.MRNA/);return [{id:'saved',answer:'saved answer'}]};
const recovered=await ctx.requestDetailOpinion(payload);
assert.equal(recovered.analysis_id,'saved');assert.equal(recovered.reused_saved_analysis,true);assert.equal(posts,1);
ctx.rest=async()=>[];
await assert.rejects(ctx.requestDetailOpinion(payload),e=>e.code==='RESPONSE_UNCONFIRMED');
assert.match(ctx.detailOpinionError({code:'RESPONSE_UNCONFIRMED'}),/入力|입력한 내용은 유지/);
ctx.authFetch=async()=>({ok:false,json:async()=>({code:'ANALYSIS_RUNNING'})});
await assert.rejects(ctx.requestDetailOpinion(payload),e=>e.code==='ANALYSIS_RUNNING');
ctx.authFetch=async()=>({ok:false,json:async()=>({code:'DAILY_LIMIT',message:'daily limit'})});
await assert.rejects(ctx.requestDetailOpinion(payload),e=>e.code==='DAILY_LIMIT');
ctx.authFetch=async()=>({ok:true,json:async()=>({answer:'new',analysis_id:'new'})});
assert.equal((await ctx.requestDetailOpinion(payload)).analysis_id,'new');
await assert.rejects(ctx.opinionDeadline(()=>new Promise(()=>{}),5),e=>e.code==='RESPONSE_UNCONFIRMED');
// A response whose headers arrived but body never finished must release the UI too.
const originalTimer=ctx.setTimeout;ctx.setTimeout=(fn,ms)=>originalTimer(fn,Math.min(ms,5));
ctx.authFetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
await assert.rejects(ctx.requestDetailOpinion(payload),e=>e.code==='RESPONSE_UNCONFIRMED');
const bench=html.slice(html.indexOf('  function benchmarkCard()'),html.indexOf('  function leverageBenchmarkCard()'));
const b={ok:true,ready:true,account_return_pct:1.397,difference_pct:2.2685,benchmark_return_krw_pct:-.8715,benchmark_return_usd_pct:-.8715,account_start:'2026-09-24',account_end:'2026-09-29',price_start_date:'2026-09-23',price_end_date:'2026-09-28'};
const bc={live:{benchmark:b},period:'1W',esc:String,pct:x=>String(x),cls:()=>'',metric:(label,value)=>`<metric>${label}:${value}</metric>`};
vm.createContext(bc);vm.runInContext(bench,bc);
for(const gate of [null,{ok:false},{ok:true,state:'unavailable'},{ok:true,state:'estimated',return_estimate_pct:1.397}]){
 bc.live.performanceGate=gate;const text=bc.benchmarkCard();assert.doesNotMatch(text,/1\.397|2\.2685/);assert.match(text,/SOXX 원화 수익률:-0.8715/);
}
bc.live.performanceGate={ok:true,state:'confirmed',reliable_start:b.account_start,observed_through:b.account_end,return_estimate_pct:b.account_return_pct};
assert.match(bc.benchmarkCard(),/계좌 수익률:1.397/);
bc.live.performanceGate.partial=true;assert.doesNotMatch(bc.benchmarkCard(),/1\.397/);
bc.live.performanceGate.partial=false;bc.live.performanceGate.reliable_start='2026-09-25';assert.doesNotMatch(bc.benchmarkCard(),/1\.397/);
console.log('Build88: lost response recovery, bounded body read, retry states and account comparison gates passed');
