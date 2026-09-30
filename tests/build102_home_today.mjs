import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gate={ok:true,state:'estimated',partial:false,observed_through:'2026-10-01',investment_pnl:500};
const stocks={ok:true,period:'오늘',period_start:'2026-10-01',period_end:'2026-10-01',complete:false,items:[{security_id:'a',symbol:'ARM',pnl_krw:100},{security_id:'b',symbol:'MU',pnl_krw:-200},{symbol:'BAD',pnl_krw:99999,reason:'missing_price'}]};
const c=vm.createContext({live:{todayGate:gate,todayStocks:stocks,securityMap:{a:{},b:{}}},kstDate:()=> '2026-10-01',kstStamp:String,esc:String,cls:n=>n<0?'down':'up',signedMoney:n=>`${n}원`});
vm.runInContext(html.slice(html.indexOf('  function homeTodayCard('),html.indexOf('  function demoPortfolio(')),c);
let out=c.homeTodayCard();assert.match(out,/500원/);assert.match(out,/data-security-id="a"/);assert.match(out,/-200원/);assert.doesNotMatch(out,/BAD|99999/);assert.match(out,/계산 가능한 종목 중/);
c.live.todayGate={...gate,observed_through:'2026-09-30'};c.live.todayStocks={...stocks,period_end:'2026-09-30'};out=c.homeTodayCard();assert.match(out,/집계 대기/);assert.doesNotMatch(out,/500원|100원/);
for(const value of [null,NaN,Infinity,'']){c.live.todayGate={...gate,investment_pnl:value};assert.match(c.homeTodayCard(),/집계 대기/)}
c.live.todayGate={...gate,investment_pnl:0};assert.match(c.homeTodayCard(),/0원/);
c.live.todayGate={...gate,partial:true};assert.match(c.homeTodayCard(),/집계 대기/);
console.log('Build102: today-only account and stock scopes, missing and partial data, zero and chart links passed');
