import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');let date='2026-11-01';
const c=vm.createContext({Date,kstDate:()=>date,kstMonth:()=>date.slice(0,7)});
vm.runInContext(source.slice(source.indexOf('  function recentHistoryMonths('),source.indexOf('  function syncRecentHistory(')),c);
for(const [d,months] of [['2026-11-01',['2026-11','2026-10']],['2026-11-07',['2026-11','2026-10']],['2026-11-08',['2026-11']],['2027-01-01',['2027-01','2026-12']],['2028-03-01',['2028-03','2028-02']]]){date=d;assert.deepEqual(Array.from(c.recentHistoryMonths()),months)}
for(let year=2026;year<2036;year++)for(let month=1;month<=12;month++){date=year+'-'+String(month).padStart(2,'0')+'-01';assert.equal(c.recentHistoryMonths().length,2)}
const r=vm.createContext({live:{securityMap:{},holdings:[],reviewDecisions:[],reviewAnalyses:[],priceMeta:{}},esc:String,kstStamp:String,kstDate:()=> '2026-11-01'});
for(let i=0;i<5;i++){const id='test'+i;r.live.securityMap[id]={id,name:id,symbol:id};r.live.holdings.push({security_id:id,quantity:1});r.live.reviewDecisions.push({security_id:id,created_at:'2026-10-01',review_condition:'2026-10-31',choice:'hold'})}
vm.runInContext(source.slice(source.indexOf('  function decisionConditionState('),source.indexOf('  function officialPeriodKo('))+source.slice(source.indexOf('  function reviewHomeCard('),source.indexOf('  function benchmarkCard(')),r);
const html=r.reviewHomeCard();assert.match(html,/다시 점검할 판단 5개/);assert.equal((html.split('<details')[0].match(/review-home-item/g)||[]).length,3);assert.match(html,/다른 종목 판단 2개/);
assert.ok(source.indexOf("+(reviews?'<details class=\"home-reviews\"")<source.indexOf('+homePriceWatchCard()+flow'));
console.log('Build143: November/year rollover, 10-year bounded month window and top-three due reviews passed');
