import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const from=edge.indexOf('function readableThesisAnswer(');
const to=edge.indexOf('function thesisReviewFallback(',from);
assert.ok(from>0&&to>from);
const scope=vm.createContext({String,Number,Math});
vm.runInContext(stripTypeScriptTypes(edge.slice(from,to)),scope);
const context={thesis:{rationale:'최근 추세돌파(상승추세)'},price_evidence:{ready:true,
  symbol:'ARM',currency:'USD',price_date:'2026-09-25',latest_close:310.32,
  prior_20_closing_high:333.20,above_prior_20_closing_high:false,
  volume_vs_prior_20_average:1.35,source:'kb_openapi'}};
scope.context=context;
const observed=vm.runInContext('verifiedPriceThesis(context)',scope);
assert.match(observed[0],/과거 돌파가 없었다는 뜻은 아닙니다/);
assert.match(observed[1],/310\.32달러.*333\.2달러.*1\.35배/);
const misplaced='판단: 저장된 추세돌파는 공식 회사 공시로는 지지되지 않는 조건부 의견입니다.\n'+
  '근거: 회사 발표에는 가격 돌파의 증거가 제시되지 않았습니다.\n'+
  '선택지: 유지와 13주 축소에 따른 영향을 비교하세요.\n'+
  '다음 확인: 회사의 최신 분기 실적·가이던스와 라이선스 계약 공개일을 살피세요.';
scope.readable=misplaced;
let selected=vm.runInContext('priceThesisModelSelection(readable,context)',scope);
assert.equal(selected.opinion,null,'filings cannot validate or refute a price breakout');
assert.equal(selected.usedModelForDecision,false,'discarded model lines are not labeled as a model opinion');
assert.match(selected.next,/당시 돌파 날짜와 내 기준/);
assert.doesNotMatch(selected.next,/실적|가이던스|공시/);
scope.readable='판단: 당시 돌파는 기준과 날짜가 없어 미확인이고, 현재 참고 고점 아래이므로 유지 조건을 따로 확인하세요.\n'+
  '근거: 9월 25일 종가는 이전 20개 기록의 최고보다 낮습니다.\n'+
  '선택지: 가격 기준과 하락 영향, 상승 참여를 함께 비교하세요.\n'+
  '다음 확인: 돌파 당시 날짜와 기준 가격을 확인한 뒤 이후 종가를 비교하세요.';
selected=vm.runInContext('priceThesisModelSelection(readable,context)',scope);
assert.equal(selected.usedModelForDecision,false,'a checklist alone is not an investment opinion');
assert.match(selected.next,/이후 종가/);
// The full four-line validator correctly rejects this long and misleading
// evidence line, but the independently validated conditional opinion can be
// retained while the server replaces the evidence and all scenario numbers.
const verbose=JSON.stringify({answer_ko:'판단: 사용자 유지 조건을 아직 확인하지 못했다면 매도 판단은 유보하고, 조건을 확인한 뒤에만 축소를 검토하세요.\n'+
  '근거: 현재 종가와 참고 고점, 계좌 비중, 보유 평가액은 모두 다른 뜻입니다. '.repeat(5)+'\n'+
  '선택지: 모델이 계산한 수량은 표시하지 않습니다.\n'+
  '다음 확인: 과거 돌파 날짜와 기준 가격을 확인하고 이후 종가와 대조하세요.'});
scope.raw=verbose;
scope.evidence=null;
assert.equal(vm.runInContext('parseThesisReview(raw,evidence,context).answer',scope),null);
selected=vm.runInContext('priceThesisModelSelection(raw,context)',scope);
assert.equal(selected.usedModelForDecision,true);
assert.match(selected.opinion,/매도 판단은 유보/);
scope.raw='```json\n'+verbose+'\n```';
assert.match(vm.runInContext('priceThesisModelSelection(raw,context).opinion',scope),/매도 판단은 유보/);
scope.raw='판단: 기준 미확정이므로 확인하세요.\n다음 확인: 돌파 기준을 확인하세요.';
assert.equal(vm.runInContext('priceThesisModelSelection(raw,context).usedModelForDecision',scope),false,
  'a model checklist is not a conditional model opinion');
scope.raw='판단: 돌파가 없었으므로 이 종목은 매도해야 합니다.\n다음 확인: 돌파 가격을 확인하세요.';
assert.equal(vm.runInContext('priceThesisModelSelection(raw,context).usedModelForDecision',scope),false,
  'an invented historical failure and a sale command cannot become an opinion');
scope.raw='판단: 과거 돌파가 확인됐으므로 내 유지 조건이 남아 있다면 계속 보유를 검토하세요.\n'+
  '근거: 가격 시계열은 이번 분석에 없습니다.\n다음 확인: 돌파 기준 가격을 확인하세요.';
assert.equal(vm.runInContext('priceThesisModelSelection(raw,context).usedModelForDecision',scope),false,
  'independent extraction must still reject invented historical events');
assert.match(edge,/answerStyle\(focus,priceOnlyThesis\)/);
assert.match(edge,/priceOnlyThesis\?\(observed&&priceSelection\?\.opinion\)\|\|judgement/);
assert.match(edge,/priceOnlyThesis\?priceSelection\?\.next/);
console.log('Price-only opinion preserves historical uncertainty and filters unrelated filings and follow-up');
