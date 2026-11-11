import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const src=fs.readFileSync(process.env.WORKER_SOURCE||'supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const code=section('function n(','async function fetchCurrent(')+section('function assertCompleteBalance','function ymd(');
const row={is_cd:'XYZ',mkt_clsf:'NAS',crncy_clsf_nm:'USD',frgn_hld_q_p6:'2',krw_val_amt:'2600',std_exch_r:'1300',krw_exch_val_pl:'-130'};
async function run(value,empty=false){
 const r={...row,krw_exch_val_pl:value,...(empty?{frgn_hld_q_p6:'0',krw_val_amt:'0'}:{})},calls=[];
 const domesticRaw={dataBody:{Record1:[{is_cd:'XYZ',crncy_cd:'USD',hld_q:'2',ec_q:'2',nstmt_b_q:'0',nstmt_s_q:'0',val_amt:'2600'}],nt_asts_val_amt:'10000',val_amt_sum:'2600',dy_tfnd:'7400',fcrncy_tfnd_krw_exch_amt:'0',byng_amt_sum:'2730',val_pl_sum:'-130'}};
 let saved={official_unrealized_pnl:-0.1};
 const ctx=vm.createContext({Date,Intl,fetchCurrent:async()=>({appKey:'synthetic',token:'synthetic',domesticRaw,overseasRaw:{dataBody:{Record2:[r]}}}),fetchNativeBalance:async()=>null,attachNativePrices:x=>x,adminRpc:async(name,p)=>{calls.push(name);if(name==='apply_kb_current_snapshot_for_service')saved=p.p_holdings[0];return {ok:true};}});
 vm.runInContext(stripTypeScriptTypes(code),ctx);
 let error;try{await ctx.syncCurrent('synthetic')}catch(e){error=e;}
 return {saved,calls,error};
}
const bad=[undefined,null,'',' ','broken','NaN','Infinity'];
let reached=0;
for(const value of bad){
 const r=await run(value);
 if(r.calls.length)reached++;
 if(!process.argv.includes('--baseline')){
  assert.match(String(r.error),/BALANCE_/,String(value));
  assert.equal(r.calls.length,0,'incomplete P&L must not replace a previous observation');
  assert.equal(r.saved.official_unrealized_pnl,-0.1);
 }
}
if(process.argv.includes('--baseline')){assert.equal(reached,7);console.log({invalidResponsesSaved:reached});process.exit(0);}
for(const [raw,expected] of [['-130',-0.1],['0',0],['130',0.1]]){
 const r=await run(raw);assert.equal(r.error,undefined);assert.equal(r.saved.official_unrealized_pnl,expected);assert.equal(r.calls.length,6);
}
const empty=await run(undefined,true);assert.equal(empty.error,undefined);assert.equal(empty.saved,undefined,'explicit empty row remains ignored');
console.log('PASS: seven incomplete foreign P&L responses save nothing; literal loss/zero/gain retain expected USD values and six RPCs');
