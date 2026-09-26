import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build54i_isa_correction.sql',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
assert.match(sql,/account_total_observation_corrections/);
assert.match(sql,/on conflict\(user_id,request_id\) do nothing/);
assert.match(sql,/current_isa_correction_id/);
assert.match(sql,/coalesce\(c\.corrected_total,o\.total_assets\)/);
assert.match(sql,/coalesce\(pc\.corrected_total,prior\.total_assets\)/);
assert.doesNotMatch(sql,/delete from|update public\.account_total_observations|insert into public\.cash_flows/i);
assert.match(assistant,/isa_correction_id:m\?\.denominator\?\.isa_correction_id/);
const start=html.indexOf('  function bindIsaCorrection(){'),end=html.indexOf('  function showDemo(){',start);
assert.ok(start>0&&end>start);
const fields={isaCorrectionForm:{querySelector:()=>({disabled:false})},
  isaCorrectionStatus:{textContent:''},isaCorrectedAmount:{value:'1200007'},
  isaCorrectionReason:{value:'화면 금액 입력 오류'}};
const state={calls:[],loaded:0,rendered:0};
const observation='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ctx=vm.createContext({document:{getElementById:id=>fields[id]},
  live:{accountScope:{current_isa_observation_id:observation}},
  rpc:async(name,args)=>{state.calls.push([name,args]);return {current:true}},
  crypto:{randomUUID:()=> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},
  loadLive:async()=>{state.loaded++},render:()=>{state.rendered++},isaNotice:''});
vm.runInContext(html.slice(start,end),ctx);
vm.runInContext('bindIsaCorrection()',ctx);
await fields.isaCorrectionForm.onsubmit({preventDefault(){}});
assert.equal(state.calls.length,1);
assert.equal(state.calls[0][0],'correct_isa_total_observation');
assert.equal(state.calls[0][1].p_observation_id,observation);
assert.equal(state.calls[0][1].p_corrected_total,1200007);
assert.equal(state.loaded,1);
assert.equal(state.rendered,1);
fields.isaCorrectedAmount.value='1.5';
await fields.isaCorrectionForm.onsubmit({preventDefault(){}});
assert.equal(state.calls.length,1,'fractional KRW cannot mutate an observation');
const homeStart=html.indexOf('  function liveHome(){'),homeEnd=html.indexOf('  function demoPortfolio(){',homeStart);
const ownerScope={ok:true,snapshot_at:'2026-09-26T00:00:00Z',overlay_matches_manual:true,
  broker_account_overlap_verified:true,current_display_total:1200007,
  current_primary_value:200000,current_primary_observed_at:'2026-09-26T00:00:00Z',
  current_isa_value:1000007,current_isa_source:'user_uploaded_isa_screenshot',
  current_isa_capture_at:'2026-09-26T00:00:00Z',
  current_isa_observation_id:observation,current_isa_correction_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  isa_total_only:true,isa_unexplained_change:7,current_isa_storage_path:'private/isa/test.png'};
const displayLive={accounts:[{id:'isa',provider:'kb_securities_manual',provider_account_ref:'isa-manual'}],
  snapshots:[{snapshot_at:ownerScope.snapshot_at,total_assets:1200000,securities_value:0}],
  manualSnapshots:[],performance:null,homeChart:{items:[]},performanceGate:null,
  ledgerEstimate:null,accountScope:ownerScope,settings:{}};
const empty=()=>'';
const homeCtx=vm.createContext({live:displayLive,liveError:null,period:'1M',isaNotice:'',
  latestManualRows:()=>[],completeSnapshotPeriod:()=>false,ledgerHeadlineReady:()=>false,
  esc:String,money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',signedMoney:String,
  cls:empty,kstStamp:x=>String(x).slice(0,10),periods:empty,reconciliationHomeStatus:empty,
  assetChart:empty,metric:empty,homeBrowseCard:empty,riskOverviewCard:empty,decisionHomeCard:empty,reviewHomeCard:empty,
  cashFlowAuditCard:empty,annualGoalCard:empty,tradeTargetCard:empty,
  dividendCard:empty,priceAlertCard:empty,upcomingAgenda:empty,dataStatusCard:empty});
vm.runInContext(html.slice(homeStart,homeEnd),homeCtx);
assert.match(vm.runInContext('liveHome()',homeCtx),/id="isaCorrectionForm"/);
ownerScope.current_isa_source='kb_account_breakdown_screenshot';
assert.doesNotMatch(vm.runInContext('liveHome()',homeCtx),/id="isaCorrectionForm"/,
  'broker sourced observation cannot be corrected through uploaded-image flow');
console.log('Build 54a owner correction form, append-only history, idempotent request and AI stale marker passed');
