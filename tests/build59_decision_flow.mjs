import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build59_executable_decision.sql',import.meta.url),'utf8');
const data={shares:36,value:15154956,assets:64688793,target:15};
const sold=Math.ceil((data.value-data.assets*data.target/100)/(data.value/data.shares));
assert.equal(sold,13);
const remaining=data.value*(data.shares-sold)/data.shares;
const cash=data.value-remaining;
assert.equal(Math.round(remaining),9682333);
assert.equal(Math.round(cash),5472623);
assert.equal(Math.round(cash*0.1),547262);
assert.equal(Math.round(data.value-data.assets*0.15),5451637,
  'continuous target cash differs from the executable share sale');
const compare={ok:true,position_currency:'USD',observation_at:'2026-09-27T03:10:00Z',
  denominator:{value:data.assets},assets_before_krw:data.assets,
  current_cash_kb_krw:0,price_assumptions:{down_pct:-10,up_pct:10},
  exact_target:{target_pct:15,value_krw:data.assets*0.15,
    cash_increase_krw:data.value-data.assets*0.15,
    down_impact_krw:-data.assets*0.015,up_impact_krw:data.assets*0.015},
  hold:{quantity:36,value_krw:data.value,weight_pct:data.value/data.assets*100,
    down_impact_krw:-data.value*0.1,up_impact_krw:data.value*0.1},
  reduce:{mode:'integer_shares',shares_to_sell:sold,quantity_reference:23,
    value_krw:remaining,weight_pct:remaining/data.assets*100,
    cash_increase_krw:cash,cash_native_estimate:13*310.32,
    cash_native_price_date:'2026-09-25',
    down_impact_krw:-remaining*0.1,up_impact_krw:remaining*0.1}};
const start=html.indexOf('  function comparisonHtml('),end=html.indexOf('  function decisionImpactHtml(',start);
assert.ok(start>0&&end>start);
const scope=vm.createContext({money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>(Number(n)>0?'+':'')+Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  price:(n,c)=>Number(n).toFixed(2)+' '+c,
  num:(n,d)=>Number(n).toFixed(d),esc:String,kstStamp:String});
vm.runInContext(html.slice(start,end),scope);
scope.compare=compare;
const view=vm.runInContext('comparisonHtml(compare)',scope);
assert.match(view,/13주 매도 가정 · 23주 보유 · 14\.97%/);
assert.match(view,/하락 영향은 547,262원 작아지고, 상승 참여도 547,262원 줄어듭니다/);
assert.match(view,/5,472,623원/);
assert.match(view,/5,451,637원/);
assert.match(view,/USD 현금 보유 가정/);
assert.match(view,/환율 노출은 남습니다/);
assert.match(view,/총자산은 64,688,793원으로 같습니다/);
assert.ok(view.indexOf('13주 매도')<view.indexOf('정확히 맞춘 이론값'));

const homeStart=html.indexOf('  function reviewHomeCard('),homeEnd=html.indexOf('  function benchmarkCard(',homeStart);
assert.ok(homeStart>0&&homeEnd>homeStart);
const home=vm.createContext({live:{reviewDecisions:[{
  security_id:'synthetic-arm',created_at:'2026-09-26T12:00:00Z',
  review_condition:'종가 300달러 이하',price_snapshot:{price_date:'2026-09-25'}}],
  reviewAnalyses:[],securityMap:{'synthetic-arm':{name:'Synthetic ARM',symbol:'ARM',id:'synthetic-arm'}},
  holdings:[{security_id:'synthetic-arm',quantity:36}],
  priceMeta:{'synthetic-arm':{latest:{price_date:'2026-09-27',close:299,currency:'USD'}}}},
  esc:String,kstDate:()=> '2026-09-27'});
vm.runInContext(html.slice(homeStart,homeEnd),home);
assert.match(vm.runInContext('reviewHomeCard()',home),/저장한 종가 재검토 조건/);
assert.match(vm.runInContext('reviewHomeCard()',home),/자동 매도 신호는 아닙니다/);
home.live.priceMeta['synthetic-arm'].latest.price_date='2026-09-25';
assert.equal(vm.runInContext('reviewHomeCard()',home),'','a same-date reread is not a new trigger');
const revisitStart=html.indexOf('  function decisionReviewHtml('),revisitEnd=html.indexOf('  function officialPeriodKo(',revisitStart);
assert.ok(revisitStart>0&&revisitEnd>revisitStart);
scope.kstDate=()=> '2026-09-27';
scope.price=(n,c)=>`${n} ${c}`;
scope.weightPct=n=>`${n}%`;
scope.officialPeriodKo=()=> '분기';
vm.runInContext(html.slice(revisitStart,revisitEnd),scope);
scope.judgement={choice:'hold',reason:'synthetic reason',review_condition:'종가 300달러 이하',
  created_at:'2026-09-25T12:00:00Z',price_snapshot:{price_date:'2026-09-25',close:310,currency:'USD'},
  account_snapshot:{},scenario_snapshot:{},official_evidence_snapshot:{documents:[]}};
scope.prices=[{price_date:'2026-09-25',close:299,currency:'USD'}];
let review=vm.runInContext('decisionReviewHtml(judgement,prices,{items:[]},[])',scope);
assert.match(review,/판단 이후 새 가격 변화는 아직 확인되지 않았습니다/);
assert.doesNotMatch(review,/현재 상태 · 재검토 필요/);
scope.prices=[{date:'2026-09-26',close:299,currency:'USD'}];
review=vm.runInContext('decisionReviewHtml(judgement,prices,{items:[]},[])',scope);
assert.match(review,/재검토할 변화 있음/);
assert.match(review,/2026-09-26 종가 기준/,'the live security detail RPC uses date, not price_date');

const trendStart=edge.indexOf('function priceTrendEvidence('),trendEnd=edge.indexOf('function questionContext(',trendStart);
assert.ok(trendStart>0&&trendEnd>trendStart);
const ts=vm.createContext({Set,Number,Math});
vm.runInContext(stripTypeScriptTypes(edge.slice(trendStart,trendEnd)),ts);
const prices=Array.from({length:31},(_,i)=>({price_date:new Date(Date.UTC(2026,8,25-i)).toISOString().slice(0,10),
  close:i===0?110:i===1?120:100,volume:1000,currency:'USD',source:'kb_openapi',observed_at:'2026-09-26'}));
ts.prices=prices;
assert.equal(vm.runInContext('priceTrendEvidence(prices,"TEST","USD").prior_20_closing_high',ts),120,
  'the inspected close must be excluded from its own 20 day reference');
ts.rule={kind:'price_close',threshold:105,event_date:prices[2].price_date,created_at:'2026-09-27'};
let trend=vm.runInContext('priceTrendEvidence(prices,"TEST","USD",rule)',ts);
assert.equal(trend.approved_rule.event_breakout,false,'being above a price alone does not prove a crossing');
assert.equal(trend.approved_rule.current_above_selected_price,true);
ts.rule={kind:'prior_20_close',threshold:null,event_date:null,created_at:'2026-09-27'};
trend=vm.runInContext('priceTrendEvidence(prices,"TEST","USD",rule)',ts);
assert.equal(trend.approved_rule.event_breakout,null,'undated past breakouts remain unverified');
ts.prices=[...prices.slice(0,20),{...prices[20],source:'another-source'},...prices.slice(21)];
assert.equal(vm.runInContext('priceTrendEvidence(prices,"TEST","USD").ready',ts),false,
  'mixed source windows cannot be used as a clean breakout reference');
assert.match(sql,/comparison_evidence->'price_assumptions' is distinct from v_comparison->'price_assumptions'/);
assert.match(sql,/comparison_evidence->'reduce'->>'shares_to_sell'/);
assert.match(sql,/v_history\.price_evidence->>'price_date'/);
assert.doesNotMatch(sql,/v_comparison->>'observation_at'\)::timestamptz is distinct from p_observation_at/);
assert.match(edge,/action==='decision-review'/);
console.log('Whole-share cash/impact, prior-close window, historical uncertainty, and fresh-analysis guard verified');
