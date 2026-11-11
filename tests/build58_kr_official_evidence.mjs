import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

// Synthetic listed security and filing; this test never reads an owner's account.
const edge=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const begin=edge.indexOf('async function publicCompanyEvidence(');
const finish=edge.indexOf('function focusPolicy(',begin);
assert.ok(begin>0&&finish>begin);
assert.match(edge,/selected_security:selected\?limitObject\(selected,\[[^\]]*'market'/,
  'market must reach the official source selector');
const filingUrl='https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260925001234';
const kindUrl='https://kind.krx.co.kr/external/2026/09/25/000123/20260925001234/45678.htm';
const security={symbol:'123456',name:'가상반도체',country:'KR',market:'KOSPI',
  quantity:200,valuation_krw:9000000,notes:'비공개 사용자 메모'};
let searchBody,documentBody='가상반도체 분기보고서 접수일자 2026.09.25';
let candidateUrl=filingUrl;
const scope=vm.createContext({MODEL:'gpt-5-mini',URL,Date,Intl,AbortSignal,console,Response,
  fetch:async(url,options)=>{
    if(url==='https://api.openai.com/v1/responses'){
      searchBody=JSON.parse(options.body);
      return new Response(JSON.stringify({status:'completed',output:[
        {type:'web_search_call',action:{sources:[{url:candidateUrl}]}},
        {content:[{type:'output_text',text:JSON.stringify({
          summary:'가상반도체 공시의 확인된 내용과 자료의 한계를 함께 설명합니다.',
          published_on:'2026-09-25',period:'2026년 2분기',source_url:candidateUrl})}]}]}));
    }
    if(url===filingUrl||url===kindUrl)return new Response('<html>'+documentBody+'</html>',
      {headers:{'content-type':'text/html'}});
    throw Error('unexpected URL '+url);
  }});
vm.runInContext(stripTypeScriptTypes(edge.slice(begin,finish)),scope);
const call=()=>vm.runInContext('publicCompanyEvidence("synthetic-key",security)',scope);
scope.security=security;
let found=await call();
assert.ok(found,'dated original KRX filing can be used');
assert.equal(found.documents[0].url,filingUrl);
assert.equal(found.documents[0].published_on,'2026-09-25');
assert.equal(found.documents[0].date_verified,true);
assert.ok(searchBody.tools[0].filters.allowed_domains.some(d=>
  /dart\.fss\.or\.kr|kind\.krx\.co\.kr/.test(d)));
assert.ok(!searchBody.tools[0].filters.allowed_domains.some(d=>/sec\.gov/.test(d)),
  'a domestic listed company must not be sent to SEC-only search');
const outbound=JSON.stringify(searchBody);
assert.match(outbound,/123456/);
assert.doesNotMatch(outbound,/200|9000000|비공개 사용자 메모|quantity|valuation_krw|notes/);
candidateUrl=kindUrl;
found=await call();
assert.equal(found.documents[0].url,kindUrl,'a dated KIND original is an eligible official source');

candidateUrl='https://www.sec.gov/Archives/edgar/data/123456/report.htm';
assert.equal(await call(),null,'SEC evidence cannot be used for a Korean listing');
candidateUrl=filingUrl;
documentBody='가상반도체 공시일은 확인되지 않았습니다';
assert.equal(await call(),null,'a guessed date cannot enter the model context');
documentBody='다른회사 분기보고서 접수일자 2026.09.25';
assert.equal(await call(),null,'the source must identify the selected issuer');
documentBody='가상반도체 분기보고서 접수일자 2026. 9. 25.';
assert.ok(await call(),'Korean filings may omit zero padding in displayed dates');
scope.security={...security,country:'US'};
assert.equal(await call(),null,'conflicting market and country must not choose a provider');
console.log('Synthetic KRX filing routing, privacy, original URL, date and issuer verified');
