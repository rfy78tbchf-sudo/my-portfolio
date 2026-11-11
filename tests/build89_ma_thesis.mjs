import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
let handler,saved=null,prompt='',webSearches=0,calls=0,rejectCount=0;
const scope=vm.createContext({Request,Response,Headers,URL,Date,console,crypto,AbortSignal,
 Deno:{env:{get:()=>''},serve:fn=>handler=fn},
 fetch:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');prompt=JSON.parse(options.body).input;calls++;if(calls<=rejectCount)return new Response(JSON.stringify({status:'completed',output_text:'판단: 정배열입니다. 반드시 보유해야 합니다.'}));
 return new Response(JSON.stringify({status:'completed',id:'fixture-provider',output_text:JSON.stringify({answer_ko:'판단: 내가 정한 기간과 유지 조건이 확인되기 전에는 변경 판단을 유보하고, 조건이 약해진 경우 축소를 검토하세요.\n근거: 서버의 이동평균 참고 비교는 사용자의 기간 설정과 구분해야 합니다.\n선택지: 같은 가격 조건에서 유지와 축소의 영향을 함께 비교하세요.\n다음 확인: 이동평균 기간과 방식을 적고 다음 종가를 대조하세요.',relation:'unverified',source_phrase:''})}));}
});
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('\n')+1)),scope);
const rows=Array.from({length:240},(_,i)=>({price_date:new Date(Date.UTC(2026,8,29-i)).toISOString().slice(0,10),close:300-i,volume:100,currency:'USD',source:'fixture'}));
const evidence=vm.runInContext('priceTrendEvidence',scope),verify=vm.runInContext('verifiedPriceThesis',scope);
let e=evidence(rows,'MRNA','USD',null,'이평선 정배열');
assert.equal(e.moving_averages.basis,'reference_periods');assert.equal(e.moving_averages.order,'bullish');
assert.equal(e.moving_averages.averages[0].value,290.5);assert.equal(e.moving_averages.averages[2].value,240.5);
assert.match(verify({thesis:{rationale:'이평선 정배열'},price_evidence:e})[0],/기간은 미지정/);
e=evidence(rows,'MRNA','USD',null,'5·20·60일선 단순이동평균 정배열');assert.equal(e.moving_averages.basis,'user_periods');assert.equal(e.moving_averages.periods.join(','),'5,20,60');
for(const reason of ['이평선 정배열','이동평균 역배열','20/60/120일선 정배열'])assert.ok(evidence(rows,'MRNA','USD',null,reason).moving_averages);
assert.equal(evidence(rows.slice(0,80),'MRNA','USD',null,'정배열').moving_averages.ready,false);
assert.equal(evidence(rows.map((r,i)=>i===90?{...r,source:'other'}:r),'MRNA','USD',null,'정배열').moving_averages.ready,false);
assert.equal(evidence(rows,'MRNA','USD',null,'20/60/120일 EMA 정배열').moving_averages.ready,false);
assert.equal(evidence(rows.map((r,i)=>i===30?{...r,close:null}:r),'MRNA','USD',null,'정배열').moving_averages.ready,false);
const flat=evidence(rows.map(r=>({...r,close:100})),'MRNA','USD',null,'정배열');assert.equal(flat.moving_averages.order,'mixed');
const down=evidence(rows.map((r,i)=>({...r,close:100+i})),'MRNA','USD',null,'정배열');assert.equal(down.moving_averages.order,'bearish');
const real=process.env.MA_PRICE_FIXTURE?JSON.parse(fs.readFileSync(process.env.MA_PRICE_FIXTURE,'utf8')):rows;
const context={selected_security:{symbol:'MRNA',currency:'USD',name:'Moderna',country:'US',market:'NAS'},thesis:{version:1,rationale:'이평선 정배열'},price_evidence:evidence(real,'MRNA','USD',null,'이평선 정배열'),confidence:'estimated',account_scope:{},holdings:[]};
scope.fixture=context;scope.storeAnswer=x=>{saved=x};scope.search=()=>{webSearches++;return null};
vm.runInContext(`userFromToken=async()=> 'fixture-user';openAiKey=async()=> 'fixture-key';buildContext=async()=>fixture;publicCompanyEvidence=async()=>search();finishAnalysis=async()=>true;
 scopedRequest=async(token,path,payload)=>{
 if(path.includes('reserve_ai_analysis_request'))return {reserved:true};
 if(path.includes('remember_ai_analysis_response'))return true;
 if(path==='ai_analysis_history'){storeAnswer(payload);return [{id:'fixture-saved'}]}
 if(path.startsWith('ai_analysis_history?'))return [];
 throw Error('unexpected '+path);
 };`,scope);
const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({symbol:'MRNA',question:'이 종목의 저장된 투자 논리를 검토해줘',request_id:'00000000-0000-4000-8000-000000000089'})}));
const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
assert.equal(result.response_kind,'model_interpretation_server_metrics');assert.equal(result.history_saved,true);assert.equal(webSearches,0,'a price thesis must not use company search');
assert.ok(prompt.includes('moving_averages'));assert.match(result.answer,/이동평균 기간/);assert.doesNotMatch(result.answer,/당시 돌파|고점/);
assert.equal(saved.answer,result.answer);assert.equal(saved.price_evidence.moving_averages.basis,'reference_periods');
if(process.env.MA_PRICE_FIXTURE)console.log(JSON.stringify({price_date:context.price_evidence.price_date,moving_averages:context.price_evidence.moving_averages,answer:result.answer},null,2));
console.log('Build89: MA periods, source sufficiency, EMA distinction, exact server arithmetic, thesis routing and answer persistence passed (provider simulated)');

for(const rejected of [1,2]){
 calls=0;rejectCount=rejected;saved=null;
 const retryResponse=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({symbol:'MRNA',question:'이 종목의 저장된 투자 논리를 검토해줘',request_id:crypto.randomUUID()})}));
 const retryResult=await retryResponse.json();assert.equal(retryResponse.status,200,JSON.stringify(retryResult));
 assert.equal(calls,2,'only one repair request');
 assert.equal(retryResult.response_kind,rejected===1?'model_interpretation_server_metrics':'validated_fallback');
 assert.equal(saved.answer,retryResult.answer);assert.doesNotMatch(retryResult.answer,/반드시|보유해야/);
}
const selection=vm.runInContext('priceThesisModelSelection',scope);
assert.ok(selection('판단: 내 조건이 확인된 경우 보유할 수 있지만, 조건이 약해지면 다시 판단하세요.',context).opinion);
assert.equal(selection('판단: 내 조건이 확인된 경우 반드시 보유해야 합니다.',context).opinion,null);
console.log('Build95: rejected output repairs once; repeated rejection stays fallback; repaired answer is persisted (provider simulated)');
