import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sql=readFileSync(new URL('../supabase/build52_current_manual_independent.sql',import.meta.url),'utf8');
assert.match(sql,/where x\.user_id=\(select auth\.uid\(\)\) and x\.provider='kb_securities' and x\.active/);
assert.doesNotMatch(sql,/x\.snapshot_date\s*<=\s*t\.snapshot_date/,
  'a new manual observation cannot depend on the last KB snapshot date');
assert.match(sql,/o\.captured_at>v_isa_at/);
assert.doesNotMatch(sql,/insert into public\.(?:transactions|cash_flows|holdings|daily_account_snapshots)/);

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function liveHome(){');
const end=html.indexOf('  function demoPortfolio()',start);
const oldNav='2026-09-26T06:10:03Z';
const scope={ok:true,snapshot_at:oldNav,overlay_matches_manual:true,
  broker_account_overlap_verified:true,current_display_total:64_738_715,
  current_primary_value:55_538_715,current_primary_observed_at:oldNav,
  current_isa_value:9_200_000,current_isa_source:'manual_snapshot',
  current_isa_capture_at:'2026-09-27T03:00:00Z',isa_total_only:false};
const live={accounts:[{}],snapshots:[{snapshot_at:oldNav,total_assets:64_667_705,
  securities_value:54_000_000}],manualSnapshots:[],performance:null,
  homeChart:{items:[]},performanceGate:null,ledgerEstimate:null,accountScope:scope,settings:{}};
const empty=()=>'',money=n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원';
const ctx=vm.createContext({live,liveError:null,period:'1W',latestManualRows:()=>[],
  completeSnapshotPeriod:()=>false,ledgerHeadlineReady:()=>false,
  esc:String,money,cls:empty,kstStamp:x=>String(x).slice(0,10),periods:empty,
  reconciliationHomeStatus:empty,assetChart:empty,metric:empty,
  homeBrowseCard:empty,riskOverviewCard:empty,decisionHomeCard:empty,cashFlowAuditCard:empty,
  annualGoalCard:empty,tradeTargetCard:empty,dividendCard:empty,
  priceAlertCard:empty,upcomingAgenda:empty,dataStatusCard:empty});
vm.runInContext(html.slice(start,end),ctx);
const screen=vm.runInContext('liveHome()',ctx);
assert.match(screen,/64,738,715원/);
assert.match(screen,/ISA 총액 9,200,000원 \(수동 기록/);
assert.match(screen,/현재 ISA 총액 9,200,000원은/);
assert.doesNotMatch(screen,/차이 undefined원|ISA 새 관측은 총액만 있습니다/);
console.log('build52 new manual ISA observation remains current without a newer KB snapshot');
