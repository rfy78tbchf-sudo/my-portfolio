import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const original={security_id:'a',price_date:'2026-10-01',currency:'USD',close:85,high_52w:100,drawdown_from_52w_high_pct:-15};
const live={holdings:[{security_id:'a',quantity:2},{security_id:'a',quantity:3},{security_id:'sold',quantity:0}],securityMap:{a:{symbol:'ARM',name:'ARM',currency:'USD'}},analysis:{ok:true,items:[original]}};
const c=vm.createContext({live,kstDate:()=> '2026-10-01',esc:String,num:(n,d)=>Number(n).toFixed(d)});
vm.runInContext(html.slice(html.indexOf('  function homePriceWatchData('),html.indexOf('  function homeTodayCard(')),c);
assert.equal(c.homePriceWatchData().total,1,'multiple accounts count once; closed positions excluded');
assert.equal(c.homePriceWatchData().alerts.length,1,'exact threshold included');
assert.match(c.homePriceWatchCard(),/data-decision-detail="a"/);
for(const patch of [{price_date:'2026-09-23'},{price_date:'2026-10-02'},{price_date:'2026-02-30'},{currency:'KRW'},{close:0},{high_52w:0},{drawdown_from_52w_high_pct:null},{drawdown_from_52w_high_pct:''},{drawdown_from_52w_high_pct:NaN},{drawdown_from_52w_high_pct:-100},{drawdown_from_52w_high_pct:-40}]){
 live.analysis.items=[{...original,...patch}];assert.equal(c.homePriceWatchData().unknown,1,JSON.stringify(patch));assert.doesNotMatch(c.homePriceWatchCard(),/하락 없음/);
}
live.analysis.items=[{...original,close:85.01,drawdown_from_52w_high_pct:-14.99}];assert.equal(c.homePriceWatchData().alerts.length,0);
live.analysis.items=[{...original,price_date:'2026-09-24'}];assert.equal(c.homePriceWatchData().checked,1,'7-day boundary');
live.analysis.items=[original,original];assert.equal(c.homePriceWatchData().unknown,1,'ambiguous metrics excluded');
live.analysis={ok:false,items:[original]};assert.equal(c.homePriceWatchData().unknown,1);
live.analysis={ok:true,items:[original]};
for(let i=0;i<4;i++){let id='b'+i;live.holdings.push({security_id:id,quantity:1});live.securityMap[id]={symbol:id,name:id,currency:'USD'};live.analysis.items.push({...original,security_id:id,close:80-i,drawdown_from_52w_high_pct:-20-i})}
const d=c.homePriceWatchData();assert.equal(d.alerts[0].id,'b3');assert.equal(d.alerts.length,5);assert.match(c.homePriceWatchCard(),/나머지 2종목 보기/);
console.log('Build105: threshold, unknown coverage, stale/future/invalid dates, currency, inconsistent metrics, deduplication and sorting passed');
