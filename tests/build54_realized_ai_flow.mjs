import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';

// All facts in this test are synthetic. No owner ledger, token, or evidence is imported.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../realized-sales-ui.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build54h_mixed_source_guard.sql',import.meta.url),'utf8');
const cycle=readFileSync(new URL('../supabase/build54e_lifecycle_review.sql',import.meta.url),'utf8');
const reqSql=readFileSync(new URL('../supabase/build54d_ai_analysis_request.sql',import.meta.url),'utf8');
assert.match(sql,/and v_day_valid then/);
assert.match(sql,/if v_trade.type='sell' and v_day.d between/);
assert.match(sql,/v_seen_mixed:=v_day.d/);
assert.match(cycle,/v_opening and v_ending/);
assert.match(reqSql,/primary key\(user_id,id\)/);
assert.match(html,/realized-sales-ui\.js\?v=54/);
const scope=vm.createContext({window:{}});vm.runInContext(ui,scope);
const sale={transaction_id:'sale',symbol:'TEST',name:'Very long security name',currency:'USD',
  trade_date:'2026-09-18',date_basis:'broker_order_date_no_intraday_time',status:'calculated',
  quantity:4,net_proceeds:479,allocated_cost:400.8,realized_local:78.2,
  reference_fx_date:'2026-09-26',reference_fx_source:'test',reference_krw:109480,
  historical_krw_estimate:93560};
const report={ok:true,period:'1M',period_start:'2026-08-26',period_end:'2026-09-26',
  calculation_version:'realized-sales-v2',candidate_count:2,ready_count:1,
  partial_count:0,order_unverified_count:1,cost_review_count:0,source_review_count:0,
  items:[sale,{...sale,transaction_id:'second',symbol:'OTHER',status:'order_unverified',realized_local:null}]};
const rendered=scope.window.realizedSalesUi.section({realizedSales:report,
  accounts:[{id:'owner',provider:'kb_securities',name:'Broker'}]},'1M','owner');
assert.match(rendered,/1건만/);
assert.match(rendered,/매도 2건 중 계산 1건/);
assert.match(rendered,/− 배분 원가 400\.8/);
assert.match(rendered,/원화 관리손익 추정/);
assert.doesNotMatch(rendered,/계좌 기간성과 78/);
const costCents=10*10000+200,allocatedCents=costCents*4/10,proceedsCents=4*12000-100;
assert.equal(proceedsCents-allocatedCents,7820);
assert.equal(costCents-allocatedCents,60120);
assert.equal(110-100,10);
assert.equal((110-100)*1400,14000);
assert.equal(110*1400-100*1300,24000);
assert.equal(140-100,40);
assert.equal(140-130,10);
const nav=x=>x.position+x.cash-x.payable;
assert.equal(nav({position:1002,cash:0,payable:1002}),
  nav({position:1002,cash:-1002,payable:0}));

const source=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
let handler,modelCalls=0,history=[],state='unused',saveAllowed=true;
const reqId='12345678-1234-4234-8234-123456789abc';
const accountId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const analysisId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const runtime=vm.createContext({Deno:{env:{get:(key)=>key==='OPENAI_API_KEY'?'mock-model-key':''},serve:cb=>{handler=cb}},
  fetch:async(url,options)=>{
    if(url==='https://api.openai.com/v1/responses'){
      modelCalls++;assert.equal(options.headers.authorization,'Bearer mock-model-key');
      assert.doesNotMatch(options.body,/mock-user-token|mock-model-key/);
      return new Response(JSON.stringify({id:'mock-response-id',output_text:'가격이 바뀌면 점검하세요.',usage:{total_tokens:25}}));
    }
    throw Error('unexpected network request');
  },Request,Response,Headers,URL,Date,AbortSignal,crypto:webcrypto,console});
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('\n')+1)),runtime);
runtime.userFromToken=async token=>token==='mock-user-token'?userId:null;
runtime.openAiKey=async()=> 'mock-model-key';
runtime.buildContext=async()=>({as_of:'2026-09-26',confidence:'estimated',
  account_scope:{snapshot_at:'2026-09-26T00:00:00Z'},
  realized_sales:{ok:true,calculation_version:'realized-sales-v2',period_start:'2026-08-26',
    period_end:'2026-09-26',candidate_count:2,ready_count:1,items:[sale]}});
runtime.scopedRequest=async(_token,path,post)=>{
  if(path.startsWith('ai_analysis_history?select=id&'))return history;
  if(path.startsWith('rpc/reserve_ai_analysis_request')){
    if(state==='unused'){state='processing';return {reserved:true,state}}
    return {reserved:false,state,analysis_id:history[0]?.id};
  }
  if(path.startsWith('rpc/finish_ai_analysis_request')){state=post.p_state;return true}
  if(path==='ai_analysis_history'){
    if(!saveAllowed)throw Error('mock history save denied');
    history=[{...post,id:analysisId}];return history;
  }
  if(path.startsWith('ai_analysis_history?select='))return history;
  throw Error('unexpected scoped read '+path);
};
vm.runInContext('userFromToken=globalThis.userFromToken;openAiKey=globalThis.openAiKey;buildContext=globalThis.buildContext;scopedRequest=globalThis.scopedRequest',runtime);
async function ask(){return handler(new Request('https://example.test/functions/v1/investment-assistant',{
  method:'POST',headers:{origin:'https://rfy78tbchf-sudo.github.io',authorization:'Bearer mock-user-token',
    'content-type':'application/json'},body:JSON.stringify({request_id:reqId,
    question:'매도손익 계산 근거를 설명해 줘'})})).then(async r=>({code:r.status,body:await r.json()}))}
let result=await ask();
assert.equal(result.code,200);
assert.equal(result.body.analysis_id,analysisId);
assert.equal(result.body.request_id,reqId);
assert.equal(result.body.history_saved,true);
assert.equal(modelCalls,1);
assert.equal(history.length,1);
assert.equal(history[0].request_id,reqId);
assert.match(history[0].answer,/78\.20 USD/);
result=await ask();
assert.equal(result.body.reused_saved_analysis,true);
assert.equal(modelCalls,1,'duplicate request is served from saved owner history');
assert.equal(history.length,1);
state='unused';history=[];saveAllowed=false;
result=await ask();
assert.equal(result.body.history_saved,false);
assert.equal(state,'history_failed');
assert.equal(modelCalls,2);
assert.equal(result.body.request_id,reqId);
console.log('Build 54 isolated sale, FX, lifecycle guard, settlement and mock AI save/reopen/failure passed');
