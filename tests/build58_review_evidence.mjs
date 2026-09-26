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
  signedMoney:n=>`${n}원`,Set});
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
assert.match(text,/새 공식 발표는 아직 확인되지 않았습니다/,'an old publication fetched again is not a new event');
assert.match(text,/현재 종가가 저장한 기준에 해당/);
assert.match(text,/원장에 기록된 매매 매도/);
assert.match(text,/종목 가격만 비교/);
assert.match(text,/실제 거래 아님/);
scope.articles=[...articles,{created_at:'2026-09-12T09:00:00Z',official_evidence:{documents:[
  {url:'https://www.sec.gov/new',published_on:'2026-09-10',period:'Q2 FY27'}]}}];
text=vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope);
assert.match(text,/판단 이후 발표된 공식 자료 1건/);
scope.articles=[{created_at:'2026-09-12T09:00:00Z',official_evidence:{documents:[
  {url:'https://www.sec.gov/unverified',published_on:null}]}}];
assert.match(vm.runInContext('decisionReviewHtml(judgement,prices,activity,articles)',scope),/새 공식 발표는 아직 확인되지 않았습니다/);
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
const homeStart=html.indexOf('  function reviewHomeCard('),homeEnd=html.indexOf('  function benchmarkCard(',homeStart);
assert.ok(homeStart>0&&homeEnd>homeStart);
const homeScope=vm.createContext({esc:String,kstDate:()=> '2026-09-26',live:{
  securityMap:{held:{id:'held',symbol:'TEST',name:'Test Holding'}},holdings:[{security_id:'held',quantity:10}],
  reviewDecisions:[{security_id:'held',created_at:'2026-09-01',review_condition:'2026-10-02 확인',
    official_evidence_snapshot:{documents:[{url:'https://www.sec.gov/old'}]}}],reviewAnalyses:[]}});
vm.runInContext(html.slice(homeStart,homeEnd),homeScope);
assert.equal(vm.runInContext('reviewHomeCard()',homeScope),'','a future date is not due');
homeScope.live.reviewAnalyses=[{symbol:'OTHER',created_at:'2026-09-05',official_evidence:{documents:[
  {url:'https://www.sec.gov/new',published_on:'2026-09-04'}]}}];
assert.equal(vm.runInContext('reviewHomeCard()',homeScope),'','another holding’s filing is not reused');
homeScope.live.reviewAnalyses[0].symbol='TEST';
assert.match(vm.runInContext('reviewHomeCard()',homeScope),/지난 판단 이후 보기/);
homeScope.live.reviewAnalyses=[];
homeScope.live.reviewDecisions[0].review_condition='2026-09-22 확인';
assert.match(vm.runInContext('reviewHomeCard()',homeScope),/점검 날짜/);
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
      {content:[{type:'output_text',text:JSON.stringify({summary:'The issuer reports a period result, while guidance remains an expectation.',published_on:'2026-07-29',period:'quarter ended June 30, 2026',source_url:officialUrl})}]}]}),
      {headers:{'content-type':'application/json'}})
  },Response});
vm.runInContext(stripTypeScriptTypes(edge.slice(begin,finish)),evidenceScope);
const evidence=await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope);
assert.equal(evidence.documents[0].published_on,'2026-07-29');
assert.equal(evidence.documents[0].date_verified,true);
assert.equal(calls.length,2);
assert.deepEqual(JSON.parse(calls[0].options.body).tools[0].filters.allowed_domains,
  ['sec.gov','investors.arm.com','newsroom.arm.com']);
assert.ok(!calls[0].options.body.includes('holdings')&&!calls[0].options.body.includes('memo'));
calls=[];
evidenceScope.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url===officialUrl)return new Response('<html>Report date cannot be confirmed</html>',{headers:{'content-type':'text/html'}});
  return new Response(JSON.stringify({status:'completed',output:[
    {type:'web_search_call',action:{sources:[{url:officialUrl}]}},
    {content:[{type:'output_text',text:JSON.stringify({summary:'The linked official report describes the reporting period without an independently confirmed publication date.',published_on:'2026-07-29',period:'a quarter',source_url:officialUrl})}]}]}));
};
const unverified=await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"ARM",name:"Arm Holdings",country:"US",market:"NASDAQ"})',evidenceScope);
assert.equal(unverified,null,'an unverified search date cannot enter the model context');
assert.equal(await vm.runInContext('publicCompanyEvidence("dummy",{symbol:"SOXL",name:"Leveraged ETF"})',evidenceScope),null);
console.log('Official publication versus retrieval, same-currency price, actual ledger events and saved evidence separated');
