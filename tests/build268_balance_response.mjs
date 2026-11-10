import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// All broker responses and persisted values in this test are synthetic.
const worker=fs.readFileSync(process.env.WORKER_SOURCE||'supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(start,end)=>worker.slice(worker.indexOf(start),worker.indexOf(end,worker.indexOf(start)));
const code=section('function n(', 'async function fetchCurrent(')+section('function assertCompleteBalance','function ymd(');
const baseline=process.argv.includes('--baseline');
const row={is_cd:'123456',crncy_cd:'KRW',hld_q:'10',ec_q:'10',ordr_psbl_q:'10',nstmt_s_q:'0',val_amt:'1000',byng_amt:'900'};
const domestic=rows=>({dataBody:{Record1:rows,nt_asts_val_amt:'10000',val_amt_sum:'1000',dy_tfnd:'9000',fcrncy_tfnd_krw_exch_amt:'0',byng_amt_sum:'900',val_pl_sum:'100'}});
const overseas={dataBody:{Record2:[]}};
const invalid=[
 ['missing symbol',domestic([{...row,is_cd:''}])],
 ['missing quantities',domestic([{is_cd:'123456',crncy_cd:'KRW',val_amt:'1000'}])],
 ['invalid quantity',domestic([{...row,hld_q:'broken'}])],
 ['missing valuation',domestic([{...row,val_amt:undefined}])],
 ['invalid valuation',domestic([{...row,val_amt:'broken'}])],
 ['negative quantity',domestic([{...row,hld_q:'-10'}])],
 ['duplicate domestic position',domestic([row,{...row}])],
 ['domestic next page',{dataBody:{...domestic([row]).dataBody,nxt_key:'next'}}],
 ['empty rows with nonzero securities',domestic([])],
 ['null domestic row',domestic([null])],
];
async function run(d,o=overseas){
 const calls=[];let saved=[{symbol:'123456',quantity:10,market_value:1000}];
 const ctx=vm.createContext({Date,Intl,fetchCurrent:async()=>({appKey:'synthetic',token:'synthetic',domesticRaw:d,overseasRaw:o}),
  fetchNativeBalance:async()=>null,attachNativePrices:h=>h,
  adminRpc:async(name,args)=>{calls.push(name);if(name==='apply_kb_current_snapshot_for_service')saved=args.p_holdings;return {ok:true}}});
 vm.runInContext(stripTypeScriptTypes(code),ctx);
 let error=null;try{await ctx.syncCurrent('synthetic-owner')}catch(e){error=e}
 return {calls,saved:JSON.parse(JSON.stringify(saved)),error};
}
let reached=0;
for(const [name,d] of invalid){
 const r=await run(d);
 if(r.calls.includes('apply_kb_current_snapshot_for_service'))reached++;
 if(!baseline){
  assert.match(String(r.error),/BALANCE_/,name);
  assert.equal(r.calls.length,0,name+' must fail before any storage RPC');
  assert.deepEqual(r.saved,[{symbol:'123456',quantity:10,market_value:1000}],name+' preserves prior state');
 }
}
if(baseline){assert.ok(reached>0);console.log(JSON.stringify({invalidCases:invalid.length,reachedStorage:reached}));process.exit(0)}
const good=await run(domestic([row]));assert.equal(good.error,null);assert.equal(good.saved[0].quantity,10);assert.equal(good.saved[0].market_value,1000);
const zero=domestic([]);zero.dataBody.val_amt_sum='0';zero.dataBody.byng_amt_sum='0';zero.dataBody.val_pl_sum='0';
const sold=await run(zero);assert.equal(sold.error,null);assert.deepEqual(sold.saved,[],'genuine empty balance may clear sold holdings');
const pending=domestic([{...row,val_amt:'0',byng_amt:'0',ordr_psbl_q:'0',nstmt_s_q:'10'}]);pending.dataBody.val_amt_sum='0';
assert.deepEqual((await run(pending)).saved,[],'settled sold row remains excluded');
const fractional=await run(domestic([{...row,hld_q:undefined,hld_q_p6:'0.5',val_amt:'50'}]));
assert.equal(fractional.error,null);assert.equal(fractional.saved[0].quantity,0.5);
const foreign={dataBody:{Record2:[{is_cd:'XYZ',mkt_clsf:'NAS',frgn_hld_q_p6:'2',krw_val_amt:'2600',std_exch_r:'1300',crncy_clsf_nm:'USD'}]}};
const mixed=await run(domestic([row,{is_cd:'XYZ',crncy_cd:'USD',hld_q:'2',val_amt:'2600'}]),foreign);
assert.equal(mixed.error,null);assert.equal(mixed.saved.length,2,'foreign integrated rows are not duplicated');
assert.equal(mixed.saved.find(x=>x.symbol==='XYZ').quantity,2);
// A valid explicit zero must remain valid even when an optional alias is absent.
const zeroRowData=domestic([{...row,hld_q:'0',ec_q:'0',ordr_psbl_q:'0',val_amt:'0'}]);zeroRowData.dataBody.val_amt_sum='0';
const zeroRow=await run(zeroRowData);
assert.equal(zeroRow.error,null);assert.deepEqual(zeroRow.saved,[]);
console.log(JSON.stringify({invalidCases:invalid.length,reachedStorage:reached,validCases:6,result:'PASS'}));
