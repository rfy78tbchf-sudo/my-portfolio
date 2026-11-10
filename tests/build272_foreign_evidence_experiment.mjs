import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// All broker responses and persisted values in this test are synthetic.
let worker=fs.readFileSync(process.env.WORKER_SOURCE||'supabase/functions/kb-sync-worker/index.ts','utf8');
const original=worker;
const mode=process.env.CANDIDATE||'baseline';
if(mode==='reject')worker=worker.replace('if(cur&&cur!=="KRW")continue;', 'if(false)continue;');
if(mode==='exclude')worker=worker.replace('.filter((r:any)=>/^[A-Z0-9.]{1,12}$/i', '.filter((r:any)=>!r?.crncy_cd||String(r.crncy_cd).trim().toUpperCase()==="KRW")\n    .filter((r:any)=>/^[A-Z0-9.]{1,12}$/i');
const section=(start,end)=>worker.slice(worker.indexOf(start),worker.indexOf(end,worker.indexOf(start)));
const code=section('function n(', 'async function fetchCurrent(')+section('function assertCompleteBalance','function ymd(');
const baseline=process.argv.includes('--baseline');
const row={is_cd:'123456',crncy_cd:'KRW',hld_q:'10',ec_q:'10',ordr_psbl_q:'10',nstmt_s_q:'0',nstmt_b_q:'0',val_amt:'1000',byng_amt:'900'};
const domestic=rows=>({dataBody:{Record1:rows,nt_asts_val_amt:'10000',val_amt_sum:'1000',dy_tfnd:'9000',fcrncy_tfnd_krw_exch_amt:'0',byng_amt_sum:'900',val_pl_sum:'100'}});
const overseas={dataBody:{Record2:[]}};
const invalid=[
 ['missing settled',domestic([{...row,hld_q:undefined}])],
 ['missing effective',domestic([{...row,ec_q:undefined}])],
 ['missing pending buy',domestic([{...row,nstmt_b_q:undefined}])],
 ['missing pending sell',domestic([{...row,nstmt_s_q:undefined}])],
 ['invalid pending buy',domestic([{...row,nstmt_b_q:'NaN'}])],
 ['negative pending sell',domestic([{...row,nstmt_s_q:'-1'}])],
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
  adminRpc:async(name,args)=>{calls.push(name);if(name==='save_kb_positions_for_response_for_service')ctx.evidence=JSON.parse(JSON.stringify(args.p_rows));if(name==='apply_kb_current_snapshot_for_service')saved=args.p_holdings;return {ok:true}}});
 vm.runInContext(stripTypeScriptTypes(code),ctx);
 let error=null;try{await ctx.syncCurrent('synthetic-owner')}catch(e){error=e}
 return {calls,saved:JSON.parse(JSON.stringify(saved)),error,evidence:ctx.evidence};
}

const foreign={dataBody:{Record2:[{is_cd:'XYZ',mkt_clsf:'NAS',frgn_hld_q_p6:'2',krw_val_amt:'2600',std_exch_r:'1300',crncy_clsf_nm:'USD'}]}};
const result=await run(domestic([row,{is_cd:'XYZ',crncy_cd:'USD',hld_q:'2',val_amt:'2600'}]),foreign);
if(mode==='baseline'){
 assert.equal(result.error,null);
 assert.equal(result.saved.find(x=>x.symbol==='XYZ').quantity,2);
 assert.deepEqual(result.evidence.find(x=>x.symbol==='XYZ'),{symbol:'XYZ',settled_quantity:2,effective_quantity:0,pending_buy_quantity:0,pending_sell_quantity:0});
 console.log('baseline: foreign holding 2 but absent effective/pending become explicit 0');
}else if(mode==='reject'){
 assert.ok(result.error);assert.equal(result.calls.length,0);
 console.log('reject-all candidate: complete foreign holdings and account NAV update blocked');
}else{
 assert.equal(result.error,null);assert.equal(result.saved.find(x=>x.symbol==='XYZ').quantity,2);
 assert.equal(result.evidence.some(x=>x.symbol==='XYZ'),false);
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;
 create table kb_balance_position_evidence(account_id text,symbol text,observed_at timestamptz,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,effective_quantity numeric,source text);
 insert into kb_balance_position_evidence values('synthetic','XYZ','2030-01-01',2,0,0,0,'SSQM2952');`);
 await db.exec(fs.readFileSync('supabase/build48_settlement_display.sql','utf8').split('revoke all on public.live_position_settlement_basis')[0]);
 const old=(await db.query("select effective_quantity::int q from live_position_settlement_basis where symbol='XYZ'")).rows;
 assert.deepEqual(old,[{q:0}]);await db.close();
 console.log('exclude candidate: holdings 2 preserved but actual settlement-basis view still returns historical effective 0');
}
