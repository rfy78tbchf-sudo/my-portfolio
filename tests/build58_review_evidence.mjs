import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build58_review_evidence.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const start=html.indexOf('  function decisionReviewHtml('),end=html.indexOf('  function aiSourceLinks(',start);
assert.ok(start>0&&end>start);
const scope=vm.createContext({esc:s=>String(s),kstStamp:s=>String(s),price:(n,c)=>`${n} ${c}`,
  signedMoney:n=>`${n}원`,weightPct:n=>`${n}%`,Set});
vm.runInContext(html.slice(start,end),scope);
const judgement={created_at:'2026-09-01T12:00:00Z',thesis_version:2,
  review_condition:'종가 300달러 이하',price_snapshot:{price_date:'2026-09-01',close:310,currency:'USD'},
  account_snapshot:{observation_at:'2026-09-01T11:00:00Z'},
  scenario_snapshot:{minus_ten_krw:-1000,plus_ten_krw:1000},
  official_evidence_snapshot:{documents:[{url:'https://www.sec.gov/old',published_on:'2026-07-29',period:'Q1 FY27'}]}};
const prices=[{price_date:'2026-09-02',close:299,currency:'USD'}];
const activity={items:[{kind:'sell',occurred_at:'2026-09-03T09:00:00Z'},{kind:'dividend',occurred_at:'2026-09-04'}]};
const articles=[{created_at:'2026-09-03T09:00:00Z',official_evidence:{documents:[
  {url:'https://www.sec.gov/old',published_on:'2026-07-29',period:'Q1 FY27'}]}}];
scope.judgement=judgement;scope.prices=prices;scope.activity=activity;scope.articles=articles;
let text=vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope);
assert.match(text,/새롭게 확인된 공식 변화가 없습니다/,'an old publication fetched again is not a new event');
assert.match(text,/현재 종가가 저장한 기준에 해당/);
assert.match(text,/원장에 기록된 매매 매도/);
assert.match(text,/종목 가격만 비교/);
assert.match(text,/실제 거래 아님/);
scope.articles=[...articles,{created_at:'2026-09-12T09:00:00Z',official_evidence:{documents:[
  {url:'https://www.sec.gov/new',published_on:'2026-09-10',date_verified:true,period:'Q2 FY27'}],
  thesis_relation:{status:'weaken',thesis_version:2,interpretation_ko:'사용자가 기대한 성장 지표에 미치지 못했습니다.'}}}];
text=vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope);
assert.match(text,/보유 전제 약화.*AI 해석.*성장 지표에 미치지 못했습니다/s);
scope.articles[1].official_evidence.thesis_relation.thesis_version=3;
assert.match(vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope),
  /당시 보유 이유에 미치는 영향은 아직 확인되지 않았습니다/,'a revised thesis is not the old premise');
scope.articles[1].official_evidence.thesis_relation.thesis_version=2;
scope.articles[1].official_evidence.source_mismatch=true;
assert.match(vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope),/새롭게 확인된 공식 변화가 없습니다/,
  'a filing that was misidentified as earnings cannot trigger a new thesis review');
scope.articles=[{created_at:'2026-09-12T09:00:00Z',official_evidence:{documents:[
  {url:'https://www.sec.gov/unverified',published_on:null}]}}];
assert.match(vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope),/새롭게 확인된 공식 변화가 없습니다/);
scope.judgement.scenario_snapshot.choice_comparison={target_pct:10,hold:{down_impact_krw:-1000,up_impact_krw:1000},
  reduce:{down_impact_krw:-500,up_impact_krw:500}};
assert.match(vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope),/내가 비교한 목표 비중 10%.*축소 시 하락 -500원 \/ 상승 500원/s);
scope.activity={items:[]};scope.prices=[{price_date:'2026-09-02',close:299,currency:'KRW'}];
text=vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope);
assert.match(text,/같은 통화의 날짜별 가격이 없습니다/);
assert.match(text,/충족 여부를 자동으로 단정하지 않습니다/);
assert.match(text,/계획을 체결로 취급하지 않습니다/);
assert.match(sql,/official_evidence_snapshot/);
assert.match(sql,/v_history\.official_evidence/);
assert.match(sql,/security invoker/);
assert.match(sql,/a\.user_id=v_user/);
assert.match(edge,/date_verified:!!publishedOn/);
assert.match(edge,/external_sources:publicEvidence\?\.sources\|\|\[\]/);
const reviewFrom=edge.indexOf('function readableThesisAnswer('),reviewTo=edge.indexOf('function verifiedPriceThesis(',reviewFrom);
const relationScope=vm.createContext({});
vm.runInContext(stripTypeScriptTypes(edge.slice(reviewFrom,reviewTo)),relationScope);
const compact='판단: 신제품 매출이 기대에 부합하면 보유를 검토하되 가격과 비중은 따로 판단하세요.\n'+
  '근거: 회사 발표에는 신제품 매출이 증가했다고 적혀 있으나 후속 성장 지속성은 아직 확인되지 않았습니다.\n'+
  '선택지: 사업 근거가 유지되면 보유를, 달라지면 목표 비중을 다시 계산해 비교하세요.\n'+
  '다음 확인: 다음 발표에서 신제품 매출 증가가 이어지는지 확인하세요.';
const context={thesis:{rationale:'신제품 매출 성장',version:2},price_evidence:{ready:false}};
const official={summary:'이번 분기 신제품 매출이 증가했습니다. 다음 분기 성장은 확인되지 않았습니다.'};
const json=JSON.stringify({answer_ko:compact,relation:'support',premise_ko:'신제품 매출 성장',
  source_phrase:'신제품 매출이 증가했습니다',relation_ko:'이번 분기 매출 증가는 기대를 지지하지만 지속성은 모릅니다.'});
relationScope.json=json;relationScope.official=official;relationScope.context=context;
let parsed=vm.runInContext('parseThesisReview(json,official,context)',relationScope);
assert.equal(parsed.relation.status,'support');
relationScope.json=JSON.stringify({...JSON.parse(json),source_phrase:'원문에 없는 실적 호조'});
parsed=vm.runInContext('parseThesisReview(json,official,context)',relationScope);
assert.equal(parsed.relation,null,'an invented supporting fact cannot enter the saved relation');
relationScope.json=JSON.stringify({...JSON.parse(json),answer_ko:compact.replace('보유를 검토하되',
  '저평가이므로 보유를 검토하되')});
assert.equal(vm.runInContext('parseThesisReview(json,official,context)',relationScope).answer,null,
  'an unsupported valuation conclusion is not a valid conditional opinion');
const homeStart=html.indexOf('  function reviewHomeCard('),homeEnd=html.indexOf('  function benchmarkCard(',homeStart);
assert.ok(homeStart>0&&homeEnd>homeStart);
const homeScope=vm.createContext({esc:String,kstDate:()=> '2026-09-26',live:{
  securityMap:{held:{id:'held',symbol:'TEST',name:'Test Holding'}},holdings:[{security_id:'held',quantity:10}],
  reviewDecisions:[{security_id:'held',created_at:'2026-09-01',review_condition:'2026-10-02 확인',
    official_evidence_snapshot:{documents:[{url:'https://www.sec.gov/old'}]}}],reviewAnalyses:[]}});
vm.runInContext(html.slice(homeStart,homeEnd),homeScope);
assert.equal(vm.runInContext('reviewHomeCard()',homeScope),'','a future date is not due');
homeScope.live.reviewAnalyses=[{symbol:'OTHER',created_at:'2026-09-05',official_evidence:{documents:[
  {url:'https://www.sec.gov/new',published_on:'2026-09-04',date_verified:true}],
  thesis_relation:{status:'weaken',thesis_version:2}}}];
homeScope.live.reviewDecisions[0].thesis_version=2;
assert.equal(vm.runInContext('reviewHomeCard()',homeScope),'','another holding’s filing is not reused');
homeScope.live.reviewAnalyses[0].symbol='TEST';
assert.match(vm.runInContext('reviewHomeCard()',homeScope),/지난 판단 이후 보기/);
homeScope.live.reviewAnalyses[0].official_evidence.thesis_relation=null;
assert.equal(vm.runInContext('reviewHomeCard()',homeScope),'','a generic filing cannot be a premise-change alert');
homeScope.live.reviewAnalyses=[];
homeScope.live.reviewDecisions[0].review_condition='2026-09-22 확인';
assert.match(vm.runInContext('reviewHomeCard()',homeScope),/점검 날짜/);
const localeStart=html.indexOf('  function officialPeriodKo('),localeEnd=html.indexOf('  function openSecurityDetail(',localeStart);
assert.ok(localeStart>0&&localeEnd>localeStart);
function element(tag){return {tag,children:[],_text:'',className:'',
  set textContent(value){this._text=String(value);this.children=[]},
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('')},
  get firstChild(){return this.children[0]||null},
  appendChild(child){this.children.push(child);return child},
  insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);return child},
  querySelector(name){return this.children.find(child=>child.tag===name)||null}}}
const localeScope=vm.createContext({URL,kstStamp:()=> '9. 26.',document:{createElement:element,
  createTextNode:value=>({textContent:String(value)})}});
vm.runInContext(html.slice(localeStart,localeEnd),localeScope);
let localized=element('div');localeScope.localized=localized;
vm.runInContext('aiOfficialEvidence(localized,{documents:[{period:"quarter ended March 31, 2026"}],summary:"Revenue grew 22% in the quarter."})',localeScope);
assert.doesNotMatch(localized.textContent,/Revenue grew|quarter ended/,'legacy English summaries are not shown as app copy');
localized=element('div');localeScope.localized=localized;
vm.runInContext('aiOfficialEvidence(localized,{documents:[{period:"quarter ended March 31, 2026",published_on:"2026-05-06",date_verified:true}],summary:"English old copy",summary_ko:"공식 발표는 실적 주주서한 발행을 알립니다.",source_warning_ko:"매출액은 이 발표문에 없습니다.",followup_url:"https://investors.arm.com/static-files/verified-letter"})',localeScope);
assert.match(localized.textContent,/실적 주주서한 발행/);
assert.match(localized.textContent,/2026년 3월 31일 종료 분기/);
assert.doesNotMatch(localized.textContent,/English old copy|quarter ended/);
assert.match(localized.textContent,/원문 보기/);
const answer=element('p');answer.textContent='지난 잘못된 답변';localized=element('div');localized.appendChild(answer);localeScope.localized=localized;
vm.runInContext('aiOfficialEvidence(localized,{documents:[{period:null}],source_mismatch:true,source_warning_ko:"주주총회 공시를 실적 발표로 잘못 설명했습니다."})',localeScope);
assert.match(localized.children[0].textContent,/주주총회 공시/,'a material source correction precedes the old answer');
const links=element('div');localeScope.links=links;
vm.runInContext('aiSourceLinks(links,["https://www.sec.gov/example.htm","https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260925001234"])',localeScope);
assert.match(links.textContent,/공식 자료 원문 보기/);
assert.doesNotMatch(links.textContent,/sec.gov/,'source addresses remain behind a Korean label');
assert.equal(links.children[0].children.filter(child=>child.tag==='a').length,2,'Korean and US official originals are available');
const begin=edge.indexOf('async function publicCompanyEvidence('),finish=edge.indexOf('function focusPolicy(',begin);
assert.ok(begin>0&&finish>begin);
let calls=[];
const officialUrl='https://www.sec.gov/Archives/edgar/data/123456/arm-q1.htm';
const evidenceScope=vm.createContext({MODEL:'gpt-5-mini',URL,Date,Intl,AbortSignal,console,
  fetch:async(url,options)=>{
    calls.push({url,options});
    if(url===officialUrl)return new Response('<html>July 29, 2026. Quarter ended June 30, 2026.</html>',
      {headers:{'content-type':'text/html'}});
    return new Response(JSON.stringify({status:'completed',output:[
      {type:'web_search_call',action:{sources:[{url:officialUrl}]}},
      {content:[{type:'output_text',text:JSON.stringify({summary_ko:'회사는 2026년 6월 종료 분기의 실적을 발표했습니다. 경영진 전망은 달성된 실적이 아닙니다.',source_excerpt:'Quarter ended June 30, 2026',published_on:'2026-07-29',period_ko:'2026년 6월 30일 종료 분기',source_url:officialUrl})}]}]}),
      {headers:{'content-type':'application/json'}})
  },Response});
vm.runInContext(stripTypeScriptTypes(edge.slice(begin,finish)),evidenceScope);
const evidence=await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope);
assert.equal(evidence.documents[0].published_on,'2026-07-29');
assert.equal(evidence.documents[0].date_verified,true);
assert.match(evidence.summary,/회사는/);
assert.equal(calls.length,2);
assert.deepEqual(JSON.parse(calls[0].options.body).tools[0].filters.allowed_domains,
  ['sec.gov','investors.arm.com','newsroom.arm.com']);
assert.ok(!calls[0].options.body.includes('holdings')&&!calls[0].options.body.includes('memo'));
calls=[];
evidenceScope.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url===officialUrl)return new Response('<html>Quarter ended June 30, 2026. Report date cannot be confirmed</html>',{headers:{'content-type':'text/html'}});
  return new Response(JSON.stringify({status:'completed',output:[
    {type:'web_search_call',action:{sources:[{url:officialUrl}]}},
    {content:[{type:'output_text',text:JSON.stringify({summary_ko:'회사는 분기 자료를 공개했습니다. 발표일은 확인되지 않아 새 소식으로 단정할 수 없습니다.',source_excerpt:'Quarter ended June 30, 2026',published_on:'2026-07-29',period_ko:'2026년 6월 30일 종료 분기',source_url:officialUrl})}]}]}));
};
const unverified=await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope);
assert.equal(unverified,null,'an unverified search date cannot enter the model context');
evidenceScope.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[
  {type:'web_search_call',action:{sources:[{url:'https://www.sec.gov/Archives/edgar/data/1973239/000197323926000128/0001973239-26-000128-index.htm'}]}},
  {content:[{type:'output_text',text:JSON.stringify({summary_ko:'ARM의 실적이 확인됐다고 주장하지만 이 자료는 공시 목록 페이지입니다.',source_excerpt:'Filing Date September 10 2026',published_on:'2026-09-10',period_ko:'실적 분기',source_url:'https://www.sec.gov/Archives/edgar/data/1973239/000197323926000128/0001973239-26-000128-index.htm'})}]}]}));
assert.equal(await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope),null,
  'a filing index must never be cited as the body of an earnings release');
assert.equal(await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"SOXL",name:"Leveraged ETF"})',evidenceScope),null);
const meetingUrl='https://www.sec.gov/Archives/edgar/data/123456/meeting-vote.htm';
evidenceScope.fetch=async(url)=>url===meetingUrl?
  new Response('<html>September 10, 2026. Annual General Meeting voting results. Votes cast by shareholders.</html>',
    {headers:{'content-type':'text/html'}}):
  new Response(JSON.stringify({status:'completed',output:[
    {type:'web_search_call',action:{sources:[{url:meetingUrl}]}},
    {content:[{type:'output_text',text:JSON.stringify({summary_ko:'회사는 분기 실적 발표에서 매출 증가를 확인했습니다.',
      source_excerpt:'Annual General Meeting voting results',published_on:'2026-09-10',
      period_ko:'2026년 9월',source_url:meetingUrl})}]}]}));
assert.equal(await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope),null,
  'AGM voting cannot be cited as a quarterly earnings release');
evidenceScope.fetch=async(url)=>url===meetingUrl?
  new Response('<html>September 10, 2026. Annual General Meeting voting results. Votes cast by shareholders.</html>',
    {headers:{'content-type':'text/html'}}):
  new Response(JSON.stringify({status:'completed',output:[
    {type:'web_search_call',action:{sources:[{url:meetingUrl}]}},
    {content:[{type:'output_text',text:JSON.stringify({summary_ko:'회사는 주주총회 안건의 투표 결과를 발표했습니다. 사업 실적 근거는 아닙니다.',
      source_excerpt:'Annual General Meeting voting results',published_on:'2026-09-10',
      period_ko:'2026년 9월',source_url:meetingUrl})}]}]}));
const meeting=await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope);
assert.equal(meeting.documents[0].document_kind,'주주총회 의결 결과');
console.log('Official publication versus retrieval, same-currency price, actual ledger events and saved evidence separated');
