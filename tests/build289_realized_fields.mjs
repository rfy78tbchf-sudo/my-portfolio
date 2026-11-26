import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Synthetic source rows only. Expected values are literals, not normalizer output.
const src=fs.readFileSync(process.env.WORKER_SOURCE||'supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const start=src.indexOf('async function syncHistoryMonth(');
const code=section('function n(','function currency(')+section('async function pagedTr(','async function previewHistory(')+
  section('function normalizeRealized(','async function syncHistoryMonth(')+src.slice(start,src.indexOf('\nasync function ',start+1));
const source={stnd_is_cd:'KR0000000001',trd_dt:'20300109',trd_dl_ccd:'01',ccls_q:'10',ccls_uprc:'110',b_uprc:'100',s_amt:'1100',b_amt:'1000',fee:'2',svrl_tx:'3',rlztn_pl:'95',yld:'9.5'};
async function run(rows){
 const calls=[],ctx=vm.createContext({setTimeout:f=>f(),monthBounds:()=>({start:'20300101',end:'20300131'}),
  credentials:async()=>({appKey:'synthetic',appSecret:'synthetic'}),issueToken:async()=>'synthetic',
  callTr:async(k,t,path)=>({dataBody:{Record1:path==='/api/v1/ssqm2442'?rows:[],nxt_key:''}}),
  normalizeKrSymbol:()=> '123456',loadSecurityMaster:async()=>({synthetic:{}}),refreshSecurityMaster:async()=>{},
  normalizeLedger:()=>({transactions:[],dividends:[],cashFlows:[]}),settlementEvidence:async()=>[],
  adminRpc:async(name,args)=>{calls.push({name,args});return {applied:{},evidence_written:0,retired_revisions:0,order_dates_linked:0};}
 });
 vm.runInContext(stripTypeScriptTypes(code),ctx);
 let error;try{await ctx.syncHistoryMonth('synthetic-owner','2030-01')}catch(e){error=e}
 return {calls,error};
}
const baseline=process.argv.includes('--baseline');let unsafe=0,cases=0;
for(const field of ['fee','svrl_tx','rlztn_pl'])for(const value of [undefined,null,'','  ','broken','NaN','Infinity',false,[],{},'1%']){
 const r=await run([source,{...source,[field]:value}]);cases++;
 if(r.calls.some(x=>x.name==='apply_kb_history_bundle_for_service'))unsafe++;
 if(!baseline){
  assert.match(String(r.error),new RegExp('REALIZED_FIELD_INVALID_'+field));
  assert.equal(r.calls.length,0,'invalid mixed response cannot mutate financial records or retire evidence');
 }
}
if(baseline){assert.equal(unsafe,33);console.log({cases,unsafeMonthlyWrites:unsafe});process.exit(0)}
const valid=await run([source,{...source,fee:'000000000',svrl_tx:0,rlztn_pl:'-000000005'},
 {...source,fee:' 1,002.125 ',svrl_tx:'0.25',rlztn_pl:'+10.375'}]);
assert.equal(valid.error,undefined);
const rows=JSON.parse(JSON.stringify(valid.calls.find(x=>x.name==='apply_kb_history_bundle_for_service').args.p_realized));
assert.deepEqual(rows.map(r=>[r.fee,r.tax,r.realized_pnl]),[[2,3,95],[0,0,-5],[1002.125,0.25,10.375]]);
assert.equal(rows[0].sell_amount-rows[0].buy_amount-rows[0].fee-rows[0].tax,95);
assert.deepEqual(rows[0].provider_payload,source,'retain original evidence');
assert.equal((await run([])).error,undefined,'explicit empty response remains accepted');
console.log('PASS: 33 invalid mixed responses write nothing; explicit zeros, signed P&L, source precision, literal arithmetic and empty responses preserved');
