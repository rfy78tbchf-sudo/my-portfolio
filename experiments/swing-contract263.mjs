// Contract fault injection for the UNDEPLOYED embedded-history candidate.
// No remote I/O; authorization/cap variants are synthetic, not hosted observations.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const original=html.slice(html.indexOf('  function loadSwingPrices('),html.indexOf('  function reduceSwingAlerts('));
const candidate=readFileSync('experiments/swing254.mjs','utf8').match(/const candidate=`([\s\S]*?)`;/)[1];
const ids=Array.from({length:50},(_,i)=>'synthetic-'+i);
const histories=Object.fromEntries(ids.map((id,i)=>[id,Array.from({length:i===0?0:i===1?43:200},(_,j)=>({price_date:new Date(Date.UTC(2026,10,9)-j*86400000).toISOString().slice(0,10),close:100+i+j,currency:i%2?'USD':'KRW'}))]));
async function run(source,condition){
 const target={holdings:ids.map(security_id=>({security_id,quantity:1})).concat([{security_id:ids[0],quantity:2},{security_id:'unheld',quantity:0}])};
 let calls=0,alerts=0,renders=0,active=0,maxActive=0;
 const singleRows=id=>condition==='child-denied'&&id===ids[2]?[]:histories[id].slice(0,160);
 const c=vm.createContext({Promise,Set,live:target,mode:'live',updateSwingAlerts(t){assert.equal(t,target);alerts++},render(){renders++},rest:async path=>{
  calls++;active++;maxActive=Math.max(maxActive,active);
  try{
   await Promise.resolve();const u=new URL('https://synthetic.invalid/'+path);
   if(condition==='owner-changed')c.live={holdings:[],swingPrices:{}};
   if(u.pathname==='/daily_security_prices'){
    assert.equal(u.searchParams.get('limit'),'160');assert.equal(u.searchParams.get('order'),'price_date.desc');
    const id=u.searchParams.get('security_id').slice(3);
    if(condition==='one-failure'&&id===ids[2])throw Error('synthetic individual failure');
    return singleRows(id);
   }
   assert.equal(u.searchParams.get('daily_security_prices.limit'),'160');
   assert.equal(u.searchParams.get('daily_security_prices.order'),'price_date.desc');
   if(condition==='one-failure')throw Error('synthetic batch failure');
   const chunk=u.searchParams.get('id').slice(4,-1).split(',');
   let rows=chunk.map(id=>({id,daily_security_prices:singleRows(id)}));
   if(condition==='parent-denied'||condition==='parent-cap')rows=rows.slice(0,-1);
   if(condition==='unexpected-parent')rows[0]={id:'unauthorized-extra',daily_security_prices:[]};
   // Parent shape stays valid while a nested result has lost records.
   if(condition==='child-cap')rows.forEach(r=>r.daily_security_prices=r.daily_security_prices.slice(0,100));
   return rows;
  }finally{active--}
 }});
 vm.runInContext(source,c);await c.loadSwingPrices(target);
 assert.equal(active,0);assert.ok(maxActive<=3);
 assert.equal(alerts,condition==='owner-changed'?0:1);assert.equal(renders,condition==='owner-changed'?0:1);
 if(condition==='owner-changed')assert.deepEqual(c.live,{holdings:[],swingPrices:{}});
 return {calls,maxActive,data:JSON.parse(JSON.stringify(target.swingPrices))};
}
const results=[];
for(const condition of ['normal','child-denied','parent-denied','parent-cap','unexpected-parent','one-failure','owner-changed','child-cap']){
 const before=await run(original,condition),after=await run(candidate,condition);
 const differing=ids.filter(id=>JSON.stringify(before.data[id])!==JSON.stringify(after.data[id]));
 if(condition==='child-cap')assert.equal(differing.length,48,'candidate silently accepts shortened child histories');
 else assert.deepEqual(after.data,before.data,condition);
 if(condition==='normal')for(const id of ids){assert.equal(after.data[id].length,Math.min(histories[id].length,160));assert.deepEqual(after.data[id].map(x=>x.date),after.data[id].map(x=>x.date).sort())}
 results.push({condition,beforeRequests:before.calls,afterRequests:after.calls,differingSecurities:differing.length});
}
console.log(JSON.stringify({scope:'synthetic contract fault injection; not actual PostgREST cap or hosted RLS evidence',outcome:'candidate remains rejected: nested completeness unproven and failed batch adds requests',results},null,2));
