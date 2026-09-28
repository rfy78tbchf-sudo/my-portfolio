import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('  function performanceExplanationHtml(');
const b=html.indexOf('  function livePerformance(',a);
assert.ok(a>0&&b>a);
const scope={period:'1M',periodLabel:()=> '최근 1개월',esc:String,
  cls:n=>Number(n)>=0?'up':'down',money:n=>Math.round(n).toLocaleString('ko-KR')+'원'};
vm.createContext(scope);vm.runInContext(html.slice(a,b),scope);
const data=[{name:'Earned',symbol:'GAIN',confirmed_contribution:5000},
  {name:'Lost',symbol:'LOSS',confirmed_contribution:-7000}];
scope.data=data;scope.p={period_start:'2026-08-27',period_end:'2026-09-27'};
let summary=vm.runInContext('performanceExplanationHtml(p,data,false)',scope);
assert.match(summary,/Lost.*-7,000원/);
assert.match(summary,/Earned.*5,000원/);
assert.match(summary,/전체 계좌 기간 수익이 아닙니다/);
assert.match(summary,/현재 보유 평가손익과 기간 평가 변화는 별도/);
assert.doesNotMatch(summary,/실적 때문에|금리 때문에/);
summary=vm.runInContext('performanceExplanationHtml(p,[],true)',scope);
assert.match(summary,/전체 계좌 기간손익은 위 총자산 기록/);
assert.match(summary,/현재 보유 종목 점검/);
assert.match(html,/data-performance-detail/);
const c=html.indexOf('  function decisionReviewHtml('),d=html.indexOf('  function officialPeriodKo(',c);
assert.ok(c>0&&d>c);
Object.assign(scope,{kstDate:()=> '2026-09-27',kstStamp:String,price:String,
  officialPeriodKo:()=> '분기',weightPct:String,signedMoney:String});
vm.runInContext(html.slice(c,d),scope);
scope.decision={choice:'hold',reason:'Check next report',review_condition:'차주 시황 변동',
  created_at:'2026-09-27T08:00:00Z',account_snapshot:{},price_snapshot:{},scenario_snapshot:{}};
let review=vm.runInContext('decisionReviewHtml(decision,[],{unavailable:true},[],true)',scope);
assert.match(review,/새 자료 조회에 실패했습니다/);
assert.match(review,/조건 충족 여부를 확인하지 못했습니다/);
assert.match(review,/현재 상태 · 확인 자료 부족/);
review=vm.runInContext('decisionReviewHtml(decision,[],{items:[]},[],false)',scope);
assert.match(review,/같은 자료의 재조회는 새 발표로 세지 않습니다/);
assert.doesNotMatch(review,/새 자료 조회에 실패했습니다/);
console.log('Selected-period explanation, held-stock route, and review read failures are distinct');
