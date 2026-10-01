import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
export function points(values,end='2026-10-01'){return values.map((close,i)=>({date:new Date(Date.parse(end+'T00:00:00Z')-(values.length-1-i)*86400000).toISOString().slice(0,10),close,currency:'USD'}))}
export const values=[...Array.from({length:20},(_,i)=>80+i),110,108,106,104,100,95,90,85];
const live={holdings:[{security_id:'a',quantity:2},{security_id:'a',quantity:3},{security_id:'sold',quantity:0}],securityMap:{a:{symbol:'ARM',name:'ARM',currency:'USD'}},swingPrices:{a:points(values)}};
const c=vm.createContext({live,kstDate:()=> '2026-10-01',esc:String,price:(v,c)=>`${v} ${c}`,num:(n,d)=>Number(n).toFixed(d)});
vm.runInContext(html.slice(html.indexOf('  function recentSwingPeak('),html.indexOf('  function securityChart('))+html.slice(html.indexOf('  function loadSwingPrices('),html.indexOf('  function homeTodayCard(')),c);
let peak=c.recentSwingPeak(points(values),'USD');assert.equal(peak.close,110);assert.equal(peak.date,'2026-09-24');assert.equal(peak.confirmed_date,'2026-09-29');
assert.equal(c.recentSwingPeak(points(values.slice(0,25)),'USD').state,'insufficient','not confirmed with four following closes');
assert.equal(c.recentSwingPeak(points([...values,120]),'USD').state,'broken','old peak retired after breakout');
assert.equal(c.recentSwingPeak(points(Array(30).fill(100)),'USD').state,'pending','flat is not a peak');
assert.equal(c.recentSwingPeak(points([...Array(20).fill(99),100,99,98,97,96,95]),'USD').state,'pending','tiny rally rejected');
const second=[...values,90,94,100,105,103,102,101,100,99,85];
assert.equal(c.recentSwingPeak(points(second),'USD').close,105,'most recent lower peak, not historical maximum');
for(const patch of [{close:null},{close:0},{close:NaN},{date:'2026-02-30'},{currency:'KRW'},{source:'different'}]){let data=points(values);data[4]={...data[4],...patch};assert.equal(c.recentSwingPeak(data,'USD').state,'insufficient')}
let duplicate=points(values);duplicate[4].date=duplicate[3].date;assert.equal(c.recentSwingPeak(duplicate,'USD').state,'insufficient');
assert.equal(c.homePriceWatchData().total,1);assert.equal(c.homePriceWatchData().alerts.length,1);assert.match(c.homePriceWatchCard(),/전고점 2026-09-24 · 110 USD/);
for(const end of ['2026-09-23','2026-10-02']){live.swingPrices.a=points(values,end);assert.equal(c.homePriceWatchData().unknown,1);assert.doesNotMatch(c.homePriceWatchCard(),/하락 없음/)}
live.swingPrices.a=points([...values.slice(0,-1),93.5]);assert.equal(c.homePriceWatchData().alerts.length,1,'exact -15%');
live.swingPrices.a=points([...values.slice(0,-1),93.51]);assert.equal(c.homePriceWatchData().alerts.length,0);
live.swingPrices.a=[];assert.equal(c.homePriceWatchData().unknown,1);
// Bounded optional loading: failed securities do not erase other holdings or data.
let active=0,max=0,requests=0;c.rest=async path=>{active++;max=Math.max(max,active);requests++;await new Promise(r=>setTimeout(r,1));active--;if(path.includes('eq.bad'))throw Error('unavailable');return points(values).reverse().map(p=>({...p,price_date:p.date}))};
const target={holdings:['a','b','c','d','bad'].map(security_id=>({security_id,quantity:1}))};await c.loadSwingPrices(target);assert.equal(requests,5);assert.ok(max<=3);assert.equal(target.swingPrices.bad.length,0);assert.equal(target.swingPrices.a[0].close,80);
console.log('Build106: confirmed latest swing, confirmation lag, lower peak, breakout reset, missing data, thresholds, freshness and bounded loading passed');
