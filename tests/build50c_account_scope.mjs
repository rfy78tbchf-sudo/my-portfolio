import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build50c_kb_account_scope_evidence.sql',import.meta.url),'utf8');
assert.match(sql,/broker_primary_total\+broker_isa_total=broker_aggregate_total/);
assert.match(sql,/s\.total_assets-\(l\.detail->>'manual_overlay_assets'\)::numeric=55538715/);
assert.match(sql,/\(l\.detail->>'manual_overlay_assets'\)::numeric=9128990/);
assert.match(sql,/manual_snapshot_stale/);
assert.match(sql,/manual_observed_at/);
assert.match(sql,/decision-metrics-v2/);
assert.doesNotMatch(sql,/268-376|373-886/,'no real broker account numbers are stored');
assert.equal(55_538_715+9_150_078,64_688_793);
assert.equal(55_538_715+9_128_990,64_667_705);

const begin=html.indexOf('  function liveHome(){'),end=html.indexOf('  function demoPortfolio()',begin);
assert.ok(begin>0&&end>begin);
const date='2026-09-26T00:10:03.561826Z';
const accountScope={ok:true,snapshot_at:date,overlay_matches_manual:true,
  broker_account_overlap_verified:true,kb_response_total:55_538_715,
  overlay_logged:9_128_990,manual_observed_at:'2026-09-23T03:35:38Z',
  broker_scope_capture_at:'2026-09-26T02:42:00Z',
  broker_scope_primary_value:55_538_715,broker_scope_isa_value:9_150_078,
  broker_scope_total_value:64_688_793,current_display_total:64_688_793,
  current_primary_value:55_538_715,current_primary_observed_at:date,
  current_isa_value:9_150_078,current_isa_capture_at:'2026-09-26T02:42:00Z',
  isa_unexplained_change:21_088,isa_components_at:'2026-09-23T03:35:38Z',
  isa_total_only:true};
const live={accounts:[{}],snapshots:[{snapshot_at:date,total_assets:64_667_705,
  securities_value:54_000_000}],manualSnapshots:[],performance:null,
  homeChart:{items:[]},performanceGate:null,ledgerEstimate:null,accountScope,settings:{}};
const empty=()=>'',money=n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원';
const ctx=vm.createContext({live,liveError:null,period:'1W',latestManualRows:()=>[],
  completeSnapshotPeriod:()=>false,ledgerHeadlineReady:()=>false,
  esc:String,money,cls:empty,kstStamp:()=> '9. 26. 11:42 KST',periods:()=>'',
  reconciliationHomeStatus:empty,assetChart:empty,metric:empty,
  homeBrowseCard:empty,riskOverviewCard:empty,decisionHomeCard:empty,reviewHomeCard:empty,cashFlowAuditCard:empty,
  annualGoalCard:empty,tradeTargetCard:empty,dividendCard:empty,
  priceAlertCard:empty,upcomingAgenda:empty,dataStatusCard:empty});
vm.runInContext(html.slice(begin,end),ctx);
let screen=vm.runInContext('liveHome()',ctx);
assert.match(screen,/계좌별 최신 기록 합계/);
assert.match(screen,/64,688,793원/);
assert.match(screen,/9,150,078원/);
assert.match(screen,/21,088원.*손익이나 입금으로 분류하지 않았습니다/);
assert.doesNotMatch(screen,/차이 21,088원.*현금으로/);
accountScope.broker_account_overlap_verified=false;
screen=vm.runInContext('liveHome()',ctx);
assert.match(screen,/계좌 식별자 미대조/);
assert.match(screen,/계좌 식별자 연결은 미확인/);
console.log('build50c broker split, stale manual NAV, verified and unverified rendering passed');
