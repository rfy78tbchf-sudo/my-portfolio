import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Production parser/renderers with isolated data, without network or financial writes.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const c=vm.createContext({esc,price:(n,c)=>n+' '+c,num:String,kstStamp:String,kstDate:()=> '2026-10-09',signedMoney:String,officialPeriodKo:()=>'',weightPct:String});
vm.runInContext(html.slice(html.indexOf('  function decisionReviewHtml('),html.indexOf('  function officialPeriodKo('))+
  html.slice(html.indexOf('  function reviewHomeCard('),html.indexOf('  function benchmarkCard(')),c);
const base={security_id:'held',choice:'hold',reason:'원래 기대한 변화를 확인하려고',created_at:'2026-10-01T00:00:00Z',thesis_version:1,
  price_snapshot:{price_date:'2026-10-01',close:110,currency:'USD'}};
const quote={price_date:'2026-10-08',close:90,currency:'USD'};
const decision=text=>({...base,review_condition:text});
const state=(text,q=quote,failed=false)=>c.decisionConditionState(decision(text),q,'2026-10-09',failed);
const render=(d,quotes=[quote],analyses=[],failed=false,focused=false,activity={items:[]})=>c.decisionReviewHtml(d,quotes,activity,analyses,failed,focused);
function home(d,q=quote,analyses=[]){
  c.live={reviewDecisions:[d],reviewAnalyses:analyses,securityMap:{held:{id:'held',symbol:'TEST',name:'Test'}},
    holdings:[{security_id:'held',quantity:1}],priceMeta:{held:{latest:q}}};return c.reviewHomeCard();
}
for(const text of ['다음 실적 발표 때 확인','새 공시가 나오면 보유 이유와 다시 대조','눌림목 모니터링','2026-09-01 이평선 배열 변화',
  'EMA 20·60·120 정배열 이탈','종가 100 달러 이하이면 다음 실적도 확인','2026-11-01 이후 공시를 확인','매출 성장률 20% 유지 여부',
  '가격 상승 이유 확인','종가 100달러를 넘은 배경 확인','Recheck the reported operating result'])test(`qualitative/compound checkpoint stays manual: ${text}`,()=>{
  const d=decision(text),snapshot=JSON.stringify(d),result=state(text);
  assert.equal(result.kind,'manual');assert.equal(result.state,'직접 확인할 조건');assert.equal(result.hit,false);
  const detail=render(d),card=home(d);assert.match(detail,/<b>직접 확인할 조건<\/b>/);assert.match(detail,/충족 여부를 자동으로 판정하지 않습니다/);
  assert.ok(detail.includes(esc(text)));assert.ok(card.includes(result.home));assert.ok(card.includes(esc(text)));
  for(const output of [detail,card])assert.doesNotMatch(output,/조건 구체화 필요|저장한 가격 조건에 해당|점검 날짜 도래/);
  assert.doesNotMatch(card,/다시 점검할 판단 1개/);assert.equal(JSON.stringify(d),snapshot,'old records remain unchanged');
});
for(const [name,q] of [['missing',null],['same day',{...quote,price_date:'2026-10-01'}],['new day',quote],
  ['wrong currency',{...quote,currency:'KRW'}],['missing close',{...quote,close:null}],['future date',{...quote,price_date:'2026-10-10'}]]){
  for(const failed of [false,true])for(const focused of [false,true])test(`manual does not infer a trigger from ${name}, failed=${failed}, priceFocused=${focused}`,()=>{
    const text='다음 실적 발표 때 확인',result=state(text,q,failed),detail=render(decision(text),q?[q]:[],[],failed,focused);
    assert.equal(result.kind,'manual');assert.equal(result.hit,false);assert.match(detail,/<b>직접 확인할 조건<\/b>/);
    assert.doesNotMatch(detail,/<b>(?:재검토할 변화 있음|확인된 변화 없음|새 종가 대기|조건 구체화 필요)<\/b>/);
    if(failed)assert.match(detail,/일부 최신 자료를 불러오지 못했습니다/);
  });
}
for(const text of ['', '   ', '2026-09-31','2026-10-01','2026-1-02','2026/10/10','2026-10-',
  '종가 0 달러 이하','종가 -100 달러 이하','종가 NaN 달러 이하','종가 Infinity 달러 이하','종가 1,,00 달러 이하',
  '가격 1.2.3 원 이상','종가 달러 이하','종가 100','종가 100 달러'])test(`empty/malformed structured checkpoint stays invalid: ${text}`,()=>{
    const result=state(text);assert.notEqual(result.kind,'manual');assert.equal(result.state,'조건 구체화 필요');assert.equal(result.hit,false);
    assert.match(render(decision(text)),/<b>조건 구체화 필요<\/b>/);assert.match(home(decision(text)),/조건 구체화 필요/);
});
for(const [text,q,expected,hit] of [
  ['종가 100 달러 이하',quote,'재검토할 변화 있음',true],['종가 100 달러 이상',quote,'확인된 변화 없음',false],
  ['종가 1,000.50 달러 이하',quote,'재검토할 변화 있음',true],['가격 100 원 이상',{...quote,currency:'KRW'},'확인 자료 부족',false],
  ['종가 100 달러 이하',null,'확인 자료 부족',false],['종가 100 달러 이하',{...quote,price_date:'2026-10-01'},'새 종가 대기',false],
  ['2026-10-09',quote,'재검토할 변화 있음',true],['2026-10-10',quote,'확인된 변화 없음',false]
])test(`supported rule still evaluates: ${text} / ${expected}`,()=>{
  const result=state(text,q);assert.equal(result.state,expected);assert.equal(result.hit,hit);assert.notEqual(result.kind,'manual');
  assert.match(render(decision(text),q?[q]:[]),new RegExp('<b>'+expected+'</b>'));assert.equal(home(decision(text),q).includes('다시 점검할 판단 1개'),hit);
});
test('valid price with refresh failure is not declared met',()=>{const result=state('종가 100 달러 이하',quote,true);assert.equal(result.state,'확인 자료 부족');assert.equal(result.hit,false)});
test('exact MA remains a structured comparison requiring its original evidence',()=>{
  const text='20·60·120개 종가 단순평균 정배열 이탈',result=state(text);assert.equal(result.kind,'ma');assert.equal(result.hit,false);
  assert.match(home(decision(text)),/종목을 열어 저장 당시와 이평선 배열 비교/);assert.match(render(decision(text)),/<b>확인 자료 부족<\/b>/);
  assert.doesNotMatch(render(decision(text)),/직접 확인할 조건/);
});
function analysis(extra={}){return {symbol:'TEST',created_at:'2026-10-08T01:00:00Z',official_evidence:{
  thesis_relation:{thesis_version:1,status:'weaken',interpretation_ko:'새 자료에서 보유 전제가 약해짐'},
  documents:[{url:'https://example.test/report',date_verified:true,published_on:'2026-10-08'}],...extra}}}
test('verified relevant official evidence may prompt review without satisfying the manual checkpoint',()=>{
  const d=decision('다음 실적 발표 때 확인'),analyses=[analysis()],detail=render(d,[quote],analyses);
  assert.match(detail,/<b>재검토할 변화 있음<\/b>/);assert.match(detail,/충족 여부를 자동으로 판정하지 않습니다/);
  assert.match(detail,/보유 전제 약화/);assert.match(home(d,quote,analyses),/다시 점검할 판단 1개/);
  assert.match(home(d,quote,analyses),/관련된 새 공식 자료/);assert.equal(state(d.review_condition).hit,false);
});
for(const [name,extra] of [['unknown relation',{thesis_relation:null}],['different thesis',{thesis_relation:{thesis_version:2,status:'weaken'}}],
  ['source mismatch',{source_mismatch:true}],['unverified date',{documents:[{url:'https://example.test/report',date_verified:false,published_on:'2026-10-08'}]}],
  ['old document',{documents:[{url:'https://example.test/report',date_verified:true,published_on:'2026-10-01'}]}]])test(`unrelated evidence does not invalidate manual checkpoint: ${name}`,()=>{
    const d=decision('다음 실적 발표 때 확인'),analyses=[analysis(extra)],detail=render(d,[quote],analyses);
    assert.match(detail,/<b>직접 확인할 조건<\/b>/);assert.doesNotMatch(home(d,quote,analyses),/다시 점검할 판단 1개/);
});
test('confirmed quantity change is separate review evidence, not manual fulfillment',()=>{
  const d={...decision('다음 실적 발표 때 확인'),scenario_snapshot:{choice_comparison:{hold:{quantity:3}}}};
  const detail=render(d,[quote],[],false,false,{items:[],current_quantity:2});assert.match(detail,/<b>재검토할 변화 있음<\/b>/);
  assert.match(detail,/보유 수량이 다릅니다/);assert.match(detail,/충족 여부를 자동으로 판정하지 않습니다/);
});
test('saved checkpoint text is escaped in home and detail',()=>{
  const d=decision('<img src=x onerror=alert(1)> 발표 확인');
  for(const output of [home(d),render(d)]){assert.ok(output.includes('&lt;img'));assert.doesNotMatch(output,/<img src=x/)}
});
test('input guidance distinguishes manual review from supported data comparisons',()=>{
  assert.match(html,/id="detailReview" aria-describedby="detailReviewHelp"/);
  assert.match(html,/id="detailReviewHelp"[^>]*>실적·공시 등은 직접 확인할 조건으로 저장합니다/);
  assert.match(html,/날짜·가격·이평선 비교 조건 설정/);
  assert.match(html,/직접 확인할 조건으로 기록했습니다\. 자료를 보고 직접 판단해 주세요/);
});
