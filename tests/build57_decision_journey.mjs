import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Isolated account figures. This does not read or mutate a real owner session.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  function decisionHomeCard(){');
const end=html.indexOf('  function benchmarkCard(){',begin);
assert.ok(begin>0&&end>begin);
const account={risk:{ok:true,largest_symbol:'TEST',largest_krw:12000000,
  valuation_time_aligned:true,as_of:'2026-09-26T00:00:00Z'},
  decisionMetrics:{ok:true,observation_at:'2026-09-26T00:00:00Z',
    position:{symbol:'TEST',value:12000000,weight_pct:20},
    denominator:{value:60000000},scenario:{impact_krw:-1200000}},
  securities:[{id:'synthetic-security',symbol:'TEST',name:'Synthetic Holding'}]};
const fmt=n=>Number(n).toLocaleString('ko-KR')+'원';
const scope=vm.createContext({live:account,esc:x=>String(x),money:fmt,num:(n,d)=>Number(n).toFixed(d),
  signedMoney:n=>Number(n)>0?'+'+fmt(n):fmt(n),kstStamp:x=>x,Date,Number,String});
vm.runInContext(html.slice(begin,end),scope);
let view=vm.runInContext('decisionHomeCard()',scope);
assert.match(view,/지금 점검할 것/);
assert.match(view,/12,000,000원/);
assert.match(view,/20\.0% \(참고\)/);
assert.match(view,/-1,200,000원/);
assert.match(view,/보유 이유 보기/);
assert.match(view,/AI 의견 받기/);
assert.match(view,/내 목표 비중/);
assert.doesNotMatch(view,/수익률 20%|원장 사건/);
account.risk.valuation_time_aligned=false;
view=vm.runInContext('decisionHomeCard()',scope);
assert.match(view,/평가시각 대조 필요/);
assert.doesNotMatch(view,/12,000,000원|20\.0%|homeWeightForm/);
account.risk.valuation_time_aligned=true;
account.decisionMetrics=null;
view=vm.runInContext('decisionHomeCard()',scope);
assert.doesNotMatch(view,/homeWeightForm/);
account.decisionMetrics={...account.decisionMetrics,ok:false};

assert.match(html,/thesisEditor\(results\[2\]\).*<section class="card" style="margin-top:12px"><h3>내 논리 점검/);
assert.match(html,/거래 기록과 결제 상세/);
assert.match(html,/data-decision-ai/);
assert.match(html,/get_live_weight_reduction_scenario/);
console.log('Build 57 home decisions gate misaligned figures and link thesis / AI / owner target');
