import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function observedPerformanceCard(){');
const end=source.indexOf('  function verifiedMovementCard(){',start);
assert.ok(start>0&&end>start);
const gate={ok:true,state:'estimated',partial:true,reliable_start:'2026-09-23',
  observed_through:'2026-09-25',investment_pnl:230610,external_flow:3000000,
  return_estimate_pct:.3676,cash_gap_intervals:2,opening_assets:62733405,
  closing_assets:65964015,same_day_other_source_nav_gap_krw:-264002};
const ctx=vm.createContext({live:{performanceGate:gate},period:'1M',
  esc:String,money:n=>Number(n).toLocaleString('en-US')+'원',
  signedMoney:n=>(Number(n)>0?'+':'')+Number(n).toLocaleString('en-US')+'원',
  pct:n=>Number(n).toFixed(2)+'%',cls:()=>'',kstStamp:()=> '9월 25일'});
vm.runInContext(source.slice(start,end),ctx);
const display=vm.runInContext('observedPerformanceCard()',ctx);
assert.match(display,/1M 전체 기간의 성과가 아닙니다/);
assert.match(display,/2026-09-23 ~ 2026-09-25/);
assert.match(display,/230,610원/);
assert.match(display,/외부 순입출금 · 손익 제외/);
assert.match(display,/264,002원 차이가 납니다/);
ctx.live.observationCutoffs={ok:true,same_day:true,valuation_time_aligned:false,
  nav_gap_krw:-287640,cash_gap_krw:-2774725,
  legacy:{fetched_at:'2026-09-25T09:10:03Z'},current:{fetched_at:'2026-09-25T12:35:33Z'}};
const aligned=vm.runInContext('observedPerformanceCard()',ctx);
assert.match(aligned,/287,640원/);
assert.match(aligned,/2,774,725원/);
assert.match(aligned,/조회 시각과 잔고 기준이 달라/);
assert.doesNotMatch(aligned,/1M 투자손익/);
ctx.live.performanceGate={ok:true,state:'unavailable'};
const unavailable=vm.runInContext('observedPerformanceCard()',ctx);
assert.match(unavailable,/아직 계산할 수 없습니다/);
assert.doesNotMatch(unavailable,/230,610원/);
console.log('build46 partial-window UI gate passed');
