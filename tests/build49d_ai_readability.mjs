import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const backend=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const scope=vm.createContext({Deno:{env:{get:()=>''}}});
vm.runInContext(stripTypeScriptTypes(backend.slice(backend.indexOf('\n')+1,backend.indexOf('\nDeno.serve('))),scope);
const focus=vm.runInContext('answerFocus',scope),select=vm.runInContext('questionContext',scope);
const target=vm.runInContext('requestedWeightTarget',scope);
assert.equal(target('현재 24%에서 10%로 줄이고 현금 보유'),10);
assert.equal(target('현재 24%, 목표 비중은 10%'),10);
assert.equal(target('현재 24%, 10%로 바꾸고 현금 보유'),null,'ambiguous targets cannot silently select the first percentage');
assert.equal(focus('내 포트폴리오에서 지금 확인할 위험은 무엇인가?'),'risk');
assert.equal(focus('최근 한 달 왜 벌었어?'),'performance');
assert.equal(focus('SOXX 매도 실현손익은?'),'realized');
assert.equal(focus('ARM을 계속 보유할 논리가 있어?'),'thesis');
assert.equal(focus('ARM 보유 논리와 위험을 같이 점검해 줘'),'thesis');
const observation='2026-09-26T00:10:03Z';
const context={as_of:'2026-09-26',account_scope:{broker_account_overlap_verified:false,
  snapshot_at:observation,app_display_total:60_000_000,kb_response_total:51_000_000,overlay_logged:9_000_000},confidence:'estimated',
  risk:{official_assets_krw:60_000_000,as_of:observation,valuation_time_aligned:true,
    largest_symbol:'ARM',largest_krw:15_000_000.2,top_three_krw:35_000_000.8},
  holdings:[{security:{symbol:'ARM',name:'예시 종목'},quantity:30,valuation_krw:15_000_000,as_of:observation}],
  reconciliation:{quantity_total:10,quantity_matched:5},pending_settlement_events:[{symbol:'META'}],
  thesis:null,ledger_realized:{items:[{symbol:'SOXX'}]},
  realized_sales:{ok:true,period_start:'2026-08-26',period_end:'2026-09-26',items:[{symbol:'SOXX',status:'calculated'}]},
  period_evidence:{investment_result_usable:false,cash_bridge_gaps:[{difference_krw:100}]},
  reliable_observed_period:{partial:true},selected_security:{symbol:'ARM'}};
const risk=select(context,'risk');
assert.equal(risk.risk.largest_share,'앱 표시 총자산 대비 25.00% (참고 비중)');
assert.equal(risk.risk.top_three_share,'앱 표시 총자산 대비 58.33% (참고 비중)');
assert.equal(risk.risk.top_three_value,'35,000,001원','fractional broker KRW is rounded only on display');
assert.equal(risk.risk.display_total,'60,000,000원');
assert.equal(risk.data_status.isa_kb_overlap_verified,false);
assert.equal('official_assets_krw' in risk.risk,false,'do not expose the mixed-scope numeric total for model arithmetic');
assert.equal('coverage_pct' in risk.risk,false,'coverage of combined assets is not missing-position coverage');
assert.equal('thesis' in risk,false,'missing thesis must not dominate a risk answer');
assert.equal('ledger_realized' in risk,false,'realized ledger must not dominate a risk answer');
assert.equal('period_evidence' in risk,false,'performance evidence must not dominate a risk answer');
assert.equal(select({...context,risk:{...context.risk,largest_krw:null}},'risk').risk.largest_value,null);
assert.equal(select({...context,risk:{...context.risk,valuation_time_aligned:false}},'risk').risk.top_three_share,null,
  'a time-misaligned snapshot must not acquire a precise share');
assert.equal(select({...context,account_scope:{...context.account_scope,app_display_total:65_000_000}},'risk').risk.top_three_share,null,
  'account scope mismatch must not be masked by another denominator');
assert.equal(select(context,'performance').period_evidence.investment_result_usable,false);
assert.equal(select(context,'realized').realized_sales.items[0].symbol,'SOXX');
const thesisContext=select({...context,
  thesis:{version:1,rationale:'최근 추세 돌파',updated_at:observation},
  affected_security:{status:'settlement_pending'},
  decision_metrics:{ok:true,position:{symbol:'ARM',value:15_000_000,weight_pct:23.43},
    account_scope_state:'verified',observation_at:observation}},'thesis');
assert.equal(thesisContext.thesis.version,1);
assert.equal(thesisContext.portfolio_exposure.weight_pct,23.43);
assert.equal(thesisContext.price_evidence.ready,false);
assert.equal(thesisContext.evidence_scope.price_comparison_is_user_rule,false);
assert.equal('affected_security' in thesisContext,false,'settlement state is not thesis evidence');
assert.equal('recent_trades' in thesisContext,false,'transaction rows do not verify a price breakout');
assert.equal('account_scope' in thesisContext,false,'internal account diagnostics are excluded from a thesis review');
const validate=vm.runInContext('readableThesisAnswer',scope);
const fallback=vm.runInContext('thesisReviewFallback',scope);
const priceEvidence=vm.runInContext('priceTrendEvidence',scope);
const synthetic=Array.from({length:21},(_,i)=>({price_date:'2026-09-'+String(25-i).padStart(2,'0'),
  close:i===0?110:i===1?120:100,volume:i===0?200:100,currency:'USD',source:'kb_openapi',
  observed_at:observation}));
const verified=priceEvidence(synthetic,'TEST','USD');
assert.equal(verified.ready,true);
assert.equal(verified.above_prior_20_closing_high,false);
assert.equal(verified.prior_20_closing_high,120);
assert.equal(verified.volume_vs_prior_20_average,2);
assert.equal(priceEvidence([...synthetic,{...synthetic[0],close:999,observed_at:'2026-09-20'}],
  'TEST','USD').latest_close,110,'duplicate price dates do not inflate the 20-day window');
assert.equal(priceEvidence(synthetic.slice(0,20),'TEST','USD').ready,false);
assert.equal(priceEvidence(synthetic.map((row,i)=>i===10?{...row,currency:'KRW'}:row),'TEST','USD').ready,false);
assert.equal(priceEvidence(synthetic.map((row,i)=>i===10?{...row,source:'other'}:row),'TEST','USD').ready,false);
const withPrice={...context,selected_security:{symbol:'TEST',currency:'USD'},
  thesis:{version:2,rationale:'최근 추세 돌파'},price_evidence:verified};
const review=select(withPrice,'thesis');
assert.equal(review.price_evidence.latest_close,110);
assert.equal(review.price_evidence.source_label,'KB 가격 원본');
assert.equal(review.evidence_scope.price_comparison_is_user_rule,false);
assert.match(fallback(withPrice),/110달러.*120달러/);
assert.match(fallback(withPrice),/지금은 미충족입니다/,'reference threshold has a concrete conditional result');
assert.match(fallback({...withPrice,price_evidence:{...verified,latest_close:130,above_prior_20_closing_high:true}}),
  /가격 근거를 더 살피고/,'a reference breakout still does not become the user’s trading rule');
assert.doesNotMatch(fallback(withPrice),/가격·거래량 시계열을 이번 분석에 사용하지/);
const poor='판단: 최근 추세 돌파를 확인한다 — 한 문장.\n'+
  '지지: ARM 비중 23.43%가 상승 논리의 근거입니다.\n'+
  '약화: settlement_pending 상태이며 관측시간 2026-09-26T12:10:03Z.\n'+
  '선택지: 유지 또는 축소를 검토합니다.';
assert.equal(validate(poor,false),null,'the screenshot-style answer is never shown as a finished review');
assert.equal(validate('판단: 논리는 조건부로 볼 수 있습니다.\n'+
  '근거: ARM 비중 23.43%가 추세 돌파의 근거입니다.\n'+
  '선택지: 이유를 점검해 보세요.\n'+
  '다음 확인: 기준 가격을 정하세요.',false),null,
'position size cannot validate price movement');
const concise='판단: 추세 돌파 논리는 이번 자료만으로 확인되지 않았습니다.\n'+
  '근거: 이 분석에 돌파 전후 가격과 거래량 시계열이 없습니다.\n'+
  '선택지: 기준을 충족할 때 보유를 검토하고, 이탈하면 비중을 다시 판단하세요.\n'+
  '다음 확인: 직접 정한 기준 기간의 종가와 거래량을 비교하세요.';
assert.equal(validate(concise,false),concise);
assert.equal(validate(concise,false,true),null,'stored price data contradict a missing-price assertion');
assert.doesNotMatch(fallback({thesis:{rationale:'최근 추세 돌파'}}),/settlement_pending|2026-09-26T/);
assert.match(fallback({thesis:{rationale:'최근 추세 돌파'}}),/가격·거래량/);
const style=vm.runInContext('answerStyle',scope)('risk');
assert.match(style,/가장 큰 위험:/);assert.match(style,/근거:/);assert.match(style,/500자/);
assert.match(vm.runInContext('answerStyle',scope)('thesis'),/비중·평가액은 투자 논리의 증거가 아니다/);
assert.match(backend,/focusPolicy\(focus\)/);
assert.match(backend,/변동성이 증가했다/,'unobserved volatility must not be claimed');
const screen=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(screen,/미분류 종목 금액이나 현금으로 단정하지 않습니다/);

const frontend=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const start=frontend.indexOf('  function renderAiAnswer('),end=frontend.indexOf('  async function ask(',start);
assert.ok(start>0&&end>start);
function element(tag){return {tag,children:[],style:{},_text:'',
  appendChild(child){this.children.push(child);return child},
  set textContent(value){this._text=String(value);this.children=[]},
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}}}
const dom=vm.createContext({window:{},document:{createElement:element,createTextNode:text=>({textContent:text})}});
vm.runInContext(frontend.slice(start,end),dom);
const render=vm.runInContext('renderAiAnswer',dom);
let output=element('div');render(output,'가장 큰 위험: ARM 비중이 높습니다.\n근거: KB 조회 총자산 대비 25%.\n다음 확인: 비중 목표를 점검하세요.');
assert.equal(output.children.length,3);
assert.equal(output.children[0].children[0].tag,'strong');
assert.match(output.textContent,/KB 조회 총자산 대비 25%/);
output=element('div');render(output,'핵심: '+('긴 설명 '.repeat(150))+'\n근거: <script>alert(1)</script>');
assert.match(output.children[1].textContent,/<script>/,'full answer remains available as text');
assert.ok(!output.children.some(x=>x.tag==='script'),'model text never becomes HTML');
output=element('div');render(output,'핵심 의견: 먼저 점검\n내 계좌 근거: 평가액 확인\n선택지 비교: 유지 또는 현금\n다음 점검 조건: 목표 비중\n자료 상태: 서로 다른 시각');
assert.equal(output.children[0].tag,'p');
assert.match(output.children[2].textContent,/유지 또는 현금/,'choices must be visible without expanding');
assert.equal(output.children[3].textContent.includes('목표 비중'),true,'next condition stays visible');
assert.equal(output.children[4].tag,'details');
assert.match(output.children[4].textContent,/서로 다른 시각/);
assert.equal(output.textContent.match(/먼저 점검/g)?.length,1,'expanding must never repeat the conclusion');
console.log('AI focus, account-scope evidence, mobile concise layout and safe expansion passed');
