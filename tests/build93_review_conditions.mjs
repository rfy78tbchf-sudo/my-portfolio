import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const c=vm.createContext({esc:String,price:(n,c)=>n+' '+c,num:String,kstStamp:String,kstDate:()=> '2026-09-30',signedMoney:String,officialPeriodKo:()=>'',weightPct:String});
vm.runInContext(html.slice(html.indexOf('  function decisionReviewHtml('),html.indexOf('  function officialPeriodKo(')),c);
const rows=Array.from({length:140},(_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),close:100+i,currency:'USD',source:'fixture'}));
const d={choice:'hold',reason:'정배열 유지',created_at:rows[119].date+'T20:00:00Z',review_condition:'20·60·120개 종가 단순평균 정배열 이탈',price_snapshot:{price_date:rows[119].date,close:219,currency:'USD'}};
function review(dec=d,prices=rows,failed=false,priceFocused=true){return c.decisionReviewHtml(dec,prices,{items:[]},[],failed,priceFocused)}
assert.match(review(),/확인된 변화 없음/);assert.match(review(),/정배열 유지/);
const down=rows.map((r,i)=>({...r,close:i>=120?1:r.close}));assert.match(review(d,down),/재검토할 변화 있음/);assert.match(review(d,down),/정배열 이탈/);
assert.match(review(d,rows.slice(0,120)),/새 종가 대기/);
assert.match(review(d,rows.slice(10)),/확인 자료 부족/);
assert.match(review(d,rows,true),/확인 자료 부족/);
assert.match(review(d,rows.map((r,i)=>i===50?{...r,close:null}:r)),/확인 자료 부족/);
assert.match(review(d,rows.map((r,i)=>i===50?{...r,source:'other'}:r)),/확인 자료 부족/);
assert.match(review(d,rows.map(r=>({...r,currency:'KRW'}))),/확인 자료 부족/);
assert.match(review(d,rows.map(r=>({...r,close:100}))),/条件|조건 구체화 필요/);
for(const condition of ['이평선 배열 변화','눌림목 모니터링','2026-09-01 이평선 배열 변화','EMA 20·60·120 정배열 이탈']){
 const result=review({...d,review_condition:condition},rows.slice(0,120));assert.match(result,/직접 확인할 조건/);assert.doesNotMatch(result,/<b>확인된 변화 없음<\/b>/);
}
assert.match(review({...d,review_condition:'종가 250 달러 이하'}),/재검토할 변화 있음/);
assert.match(review({...d,review_condition:'종가 250 달러 이하'},rows.slice(0,120)),/새 종가 대기/);
assert.match(review({...d,review_condition:'2026-09-30'}),/재검토할 변화 있음/);
assert.match(review({...d,review_condition:'2026-09-31'}),/조건 구체화 필요/);
assert.match(review({...d,review_condition:'2026-12-01'}),/확인된 변화 없음/);
assert.match(html,/20·60·120개 종가 정배열 이탈로 설정/);
console.log('Build93: ambiguous vs waiting vs triggered; saved/current MA comparison; insufficient/mixed/null/currency data; explicit dates and price thresholds passed');
