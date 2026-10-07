import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const c=vm.createContext({esc:String,kstStamp:String,kstDate:()=> '2026-10-07',price:String,signedMoney:String,weightPct:String,num:String});
vm.runInContext(source.slice(source.indexOf('  function decisionReviewHtml('),source.indexOf('  function officialPeriodKo('))+source.slice(source.indexOf('  function reviewHomeCard('),source.indexOf('  function benchmarkCard(')),c);
const d={security_id:'a',choice:'hold',created_at:'2026-10-05T16:00:00Z',price_snapshot:{price_date:'2026-10-05',currency:'USD',close:110}};
const quote={price_date:'2026-10-07',currency:'USD',close:90};
for(const [condition,q,state,hit] of [
 ['종가 100 달러 이하',quote,'재검토할 변화 있음',true],
 ['종가 100 달러 이상',quote,'확인된 변화 없음',false],
 ['종가 100 달러 이하',{...quote,price_date:'2026-10-05'},'새 종가 대기',false],
 ['종가 100 달러 이하',{...quote,close:''},'확인 자료 부족',false],
 ['종가 100 달러 이하',{...quote,close:0},'확인 자료 부족',false],
 ['종가 100 달러 이하',{...quote,price_date:'2026-10-08'},'확인 자료 부족',false],
 ['종가 100 달러 이하',{...quote,currency:'KRW'},'확인 자료 부족',false],
 ['종가 1,,00 달러 이하',quote,'조건 구체화 필요',false],
 ['종가 0 달러 이하',quote,'조건 구체화 필요',false],
 ['2026-09-31',quote,'조건 구체화 필요',false],
 ['2026-10-06',quote,'조건 구체화 필요',false],
 ['2026-10-07',quote,'재검토할 변화 있음',true],
 ['2026-10-08',quote,'확인된 변화 없음',false]
]){
 const decision={...d,review_condition:condition};const result=c.decisionConditionState(decision,q,'2026-10-07',false);
 assert.equal(result.state,state,condition);assert.equal(result.hit,hit,condition);
 c.live={securityMap:{a:{id:'a',symbol:'A',name:'Alpha'}},holdings:[{security_id:'a',quantity:1}],reviewDecisions:[decision],reviewAnalyses:[],priceMeta:{a:{latest:q}}};
 assert.equal(c.reviewHomeCard().includes('다시 점검할 판단 1개'),hit,condition);
 assert.ok(c.reviewHomeCard().includes(result.home),condition);
 assert.ok(c.decisionReviewHtml(decision,[q],{items:[]},[],false,true).includes('<b>'+state+'</b>'),condition);
}
assert.equal(c.decisionConditionState({...d,review_condition:'종가 100 달러 이하'},quote,'2026-10-07',true).hit,false);
console.log('Build158: home/detail parity, KST date boundary, invalid dates/prices, quote age/currency, due and pending conditions passed');
