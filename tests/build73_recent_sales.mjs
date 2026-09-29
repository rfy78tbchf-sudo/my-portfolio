import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=readFileSync(new URL('../supabase/functions/kb-sync-worker/index.ts',import.meta.url),'utf8');
const fn=worker.slice(worker.indexOf('async function overseasDayPnl('),worker.indexOf('// Read-only source audit:'));
for(const rows of [[],[{shrt_is_cd:'TEST',shrt_is_nm:'Synthetic',ccls_q_p6:'7',byng_avr_prc_p6:'110',frgn_ccls_prc_p6:'100',fcrncy_pl_amt_p2:'-70'}]]){
 const c={Date,todaySeoul:()=> '2026-09-29',credentials:async()=>({appKey:'synthetic',appSecret:'synthetic'}),issueToken:async()=> 'synthetic',ymd:x=>x.replaceAll('-',''),nOrNull:x=>x==null||x===''?null:Number(x),pagedTr:async(k,t,path,input)=>{assert.equal(path,'/api/v1/spqm2206');assert.equal(input.ordr_dt,'20260928');assert.equal(input.std_crncy_f,'2');return {rows,truncated:false,summary:{}}}};
 vm.createContext(c);vm.runInContext(stripTypeScriptTypes(fn),c);
 const result=await c.overseasDayPnl('isolated','2026-09-28');assert.equal(result.available,rows.length>0);if(rows.length)assert.equal(result.items[0].gross_pnl,-70);else assert.equal(result.items.length,0);
 await assert.rejects(c.overseasDayPnl('isolated','2026-09-30'));
}
const renderer=html.slice(html.indexOf('  function brokerDayResultHtml('),html.indexOf('  function bindBrokerDay('));
const c={esc:x=>String(x),num:x=>String(x),cls:x=>x<0?'down':'up',signedMoney:x=>x+'원'};vm.createContext(c);vm.runInContext(renderer,c);
const result=c.brokerDayResultHtml({items:[]},[{symbol:'TEST',type:'sell',quantity:7,settlement_date:'2026-09-30'}],false);
assert.match(result,/7주 매도/);assert.match(result,/손익 대기/);assert.doesNotMatch(result,/<strong[^>]*>0원/);
assert.match(c.brokerDayResultHtml(null,[],true),/조회 실패/);
assert.match(html,/owner.brokerDayRequest!==request/);assert.match(html,/live!==owner/);
console.log('Build73: broker day request, absent versus zero, pending sales and stale-response guards passed');
