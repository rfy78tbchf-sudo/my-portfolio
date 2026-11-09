// Non-production candidate. Run from repository root; all data and transport are synthetic.
import vm from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');
const original=html.slice(html.indexOf('  function loadSwingPrices('),html.indexOf('  function reduceSwingAlerts('));
const candidate=`function loadSwingPrices(target){
 target.swingPrices={};
 var ids=Array.from(new Set((target.holdings||[]).filter(function(h){return Number(h.quantity)>0}).map(function(h){return h.security_id}))),next=0;
 function assign(id,rows){target.swingPrices[id]=rows.slice().reverse().map(function(q){return {date:q.price_date,close:q.close,currency:q.currency}})}
 function single(id){return rest('daily_security_prices?select=price_date,close,currency&security_id=eq.'+encodeURIComponent(id)+'&order=price_date.desc&limit=160').then(function(rows){assign(id,rows||[])}).catch(function(){target.swingPrices[id]=[]})}
 function worker(){var chunk=ids.slice(next,next+10);next+=10;if(!chunk.length)return Promise.resolve();
  return rest('securities?select=id,daily_security_prices(price_date,close,currency)&id=in.('+chunk.map(encodeURIComponent).join(',')+')&daily_security_prices.order=price_date.desc&daily_security_prices.limit=160').then(function(rows){
   if(!Array.isArray(rows)||rows.length!==chunk.length||new Set(rows.map(function(r){return r.id})).size!==chunk.length||rows.some(function(r){return chunk.indexOf(r.id)<0||!Array.isArray(r.daily_security_prices)||r.daily_security_prices.length>160}))throw Error('INCOMPLETE_BATCH');
   rows.forEach(function(r){assign(r.id,r.daily_security_prices)});
  }).catch(async function(){for(var id of chunk)await single(id)}).then(worker);
 }
 return Promise.all([worker(),worker(),worker()]).then(function(){if(target===live){updateSwingAlerts(target);if(typeof mode!=='undefined'&&mode==='live')render(true)}});
}`;
export {candidate};
const ids=Array.from({length:50},(_,i)=>'synthetic-'+i);
const rows=Object.fromEntries(ids.map((id,i)=>[id,Array.from({length:i===0?0:i===1?43:200},(_,j)=>({price_date:new Date(Date.UTC(2026,10,9)-j*86400000).toISOString().slice(0,10),close:1000+i+j,currency:i%2?'USD':'KRW'}))]));
async function run(source,fault='',delay=0){
 const target={holdings:ids.map(security_id=>({security_id,quantity:1})).concat([{security_id:ids[0],quantity:2},{security_id:'not-held',quantity:0}])};
 let calls=0,active=0,max=0,alerts=0,renders=0;
 const c=vm.createContext({Promise,Set,live:target,mode:'live',updateSwingAlerts(t){assert.equal(t,target);alerts++},render(){renders++},rest:async path=>{
  calls++;active++;max=Math.max(max,active);try{
   await new Promise(r=>setTimeout(r,delay));const u=new URL('https://synthetic.test/'+path);
   if(u.pathname==='/daily_security_prices'){const id=u.searchParams.get('security_id').slice(3);if(fault==='single-error'&&id===ids[2])throw Error('failure');return rows[id].slice(0,160)}
   const batch=u.searchParams.get('id').slice(4,-1).split(',');
   assert.equal(u.searchParams.get('daily_security_prices.limit'),'160');assert.equal(u.searchParams.get('daily_security_prices.order'),'price_date.desc');
   if(fault==='batch-error'||fault==='single-error')throw Error('unavailable');
   let result=batch.map(id=>({id,daily_security_prices:rows[id].slice(0,160)}));
   if(fault==='truncated')result=result.slice(0,-1);
   if(fault==='duplicate')result[0]=result[1];
   return result;
  }finally{active--}
 }});
 vm.runInContext(source,c);const start=performance.now();await c.loadSwingPrices(target);
 assert.equal(alerts,1);assert.equal(renders,1);assert.ok(max<=3);assert.equal(active,0);
 return {ms:performance.now()-start,calls,max,data:JSON.parse(JSON.stringify(target.swingPrices))};
}
const baseline=await run(original);
for(const fault of ['', 'batch-error','truncated','duplicate'])assert.deepEqual((await run(candidate,fault)).data,baseline.data,fault);
assert.deepEqual((await run(candidate,'single-error')).data,(await run(original,'single-error')).data);
// A flat global limit is not a per-security window and silently loses history.
const flat=Object.entries(rows).flatMap(([security_id,rs])=>rs.map(r=>({...r,security_id}))).sort((a,b)=>b.price_date.localeCompare(a.price_date)).slice(0,1000);
assert.ok(ids.some(id=>flat.filter(r=>r.security_id===id).length!==Math.min(160,rows[id].length)));
const samples=[];
for(let i=0;i<5;i++)for(const [version,source] of i%2?[['after',candidate],['before',original]]:[['before',original],['after',candidate]]){
 const r=await run(source,'',50);assert.deepEqual(r.data,baseline.data);samples.push({run:i,version,ms:r.ms,requests:r.calls,max:r.max});
}
const failureSamples=[];
for(let i=0;i<3;i++)for(const [version,source] of [['before',original],['after',candidate]]){const r=await run(source,'batch-error',50);assert.deepEqual(r.data,baseline.data);failureSamples.push({run:i,version,ms:r.ms,requests:r.calls,max:r.max})}
const result={failureSamples,scope:'isolated loader VM, synthetic 50 securities, 50ms response, no browser or real backend speed claim',samples};
writeFileSync('/tmp/swing254-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
