import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Test the deployed context builder with synthetic broker data, without an AI
// request or access to a production account.
const source=fs.readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const pureSource=source.slice(source.indexOf('\n')+1,source.indexOf('\nDeno.serve('));
const testScope=vm.createContext({Deno:{env:{get:()=>''}},fetch:async()=>{throw Error('unexpected network request')}});
vm.runInContext(stripTypeScriptTypes(pureSource),testScope);

const period=vm.runInContext('questionPeriod',testScope);
assert.equal(period('이번 달 실제 투자로 얼마 벌었지?'),'1M');
assert.equal(period('오늘 얼마나 벌었어?'),'오늘');
assert.equal(period('올해 내 성과는?'),'YTD');
assert.equal(period('최근 6개월 성과는?'),'6M');

let bridgeResult=[];
let summary={return_ready:true,return_exact:true,period_start:'2026-09-24',
  start_snapshot_date:'2026-09-24',end_snapshot_date:'2026-09-25',
  investment_pnl:1_865_286,return_pct:3.064};
testScope.scopedRequest=async(_token,path)=>{
  if(path.startsWith('accounts?'))return [{id:'synthetic-account'}];
  if(path.startsWith('live_cash_observation_bridges?'))return bridgeResult;
  if(path.startsWith('rpc/get_live_performance_summary'))return summary;
  if(path.startsWith('rpc/get_live_ledger_period_estimate'))return {included_count:0,candidate_count:0};
  if(path.startsWith('rpc/get_pending_kb_position_events'))return [];
  if(path.startsWith('rpc/'))return null;
  return [];
};
vm.runInContext('scopedRequest=globalThis.scopedRequest',testScope);
const build=vm.runInContext('buildContext',testScope);
const args=['token','synthetic-user','','오늘'];

bridgeResult=[{start_date:'2026-09-24',end_date:'2026-09-25',difference_krw:100}];
let result=await build(...args);
assert.equal(result.period_evidence.investment_result_usable,false);
assert.equal('investment_pnl' in result.period_performance,false);
assert.equal('return_pct' in result.period_performance,false);

bridgeResult=null;
result=await build(...args);
assert.equal(result.period_evidence.cash_bridge_checked,false);
assert.equal('investment_pnl' in result.period_performance,false);

bridgeResult=[];
summary={...summary,start_snapshot_date:'2026-09-25'};
result=await build(...args);
assert.equal(result.period_evidence.complete_asset_snapshots,false);
assert.equal('investment_pnl' in result.period_performance,false);

summary={...summary,start_snapshot_date:'2026-09-24'};
result=await build(...args);
assert.equal(result.period_evidence.investment_result_usable,true);
assert.equal(result.period_performance.investment_pnl,1_865_286);

result=await build(...args.slice(0,3),'6M');
assert.equal(result.period_evidence.supported_period,false);
assert.equal(result.period_performance,null);
assert.equal(result.period_attribution,null);
console.log('build45 AI period evidence tests passed');
