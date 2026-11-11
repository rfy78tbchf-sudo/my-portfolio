import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
let respond,active=true,loaded=null,binds=0,query;
const button={disabled:false,textContent:''};const root={innerHTML:'',querySelector:()=>button};
const c=vm.createContext({Promise,encodeURIComponent,rest:q=>{query=q;return new Promise(r=>respond=r)},securityChart:p=>'chart:'+p.length,bindSecurityChart:()=>binds++,detailChartSettings:{}});
vm.runInContext(html.slice(html.indexOf('  function loadDetailPrices('),html.indexOf('  function openSecurityDetail(')),c);
assert.match(c.detailChartHtml([],'USD',true),/불러오지 못했습니다/);
assert.doesNotMatch(c.detailChartHtml([],'USD',true),/부족|chart-empty/);
assert.match(c.detailChartHtml([],'USD',false),/2개 이상/);
c.bindDetailChartRetry(root,'lly','USD',()=>active,p=>loaded=p);
let pending=button.onclick();await Promise.resolve();assert.equal(button.disabled,true);
respond([{price_date:'2026-10-07',close:1194},{price_date:'2026-10-06',close:1180}]);await pending;
assert.equal(loaded[0].date,'2026-10-06');assert.match(root.innerHTML,/chart:2/);assert.equal(binds,1);assert.match(query,/security_id=eq.lly/);
// A late retry must not touch the newly selected stock or its draft.
c.bindDetailChartRetry(root,'lly','USD',()=>active,p=>loaded=p);pending=button.onclick();await Promise.resolve();active=false;const previous=root.innerHTML;
respond([]);await pending;assert.equal(root.innerHTML,previous);assert.equal(loaded.length,2);
// A failed retry stays actionable; it never turns failure into missing history.
active=true;c.rest=()=>Promise.reject(Error('network'));c.bindDetailChartRetry(root,'lly','USD',()=>active,()=>assert.fail('no load'));await button.onclick();assert.match(root.innerHTML,/불러오지 못했습니다/);assert.match(root.innerHTML,/data-chart-retry/);
// Exercise the exact production RPC fallback with a technical/detail failure.
c.id='lly';c.known={symbol:'LLY'};c.owned=[{quantity:5}];c.rpc=()=>Promise.reject(Error('timeout'));c.rest=()=>Promise.resolve([{price_date:'2026-10-07',close:1194},{price_date:'2026-10-06',close:1180}]);
const start=html.indexOf("      rpc('get_live_security_detail'");const end=html.indexOf(",\n      rpc('get_live_security_activity'",start);
const d=await vm.runInContext(html.slice(start,end),c);assert.equal(d.ok,true);assert.equal(d.prices.length,2);assert.equal(d.holding.quantity,5);
c.rest=()=>Promise.reject(Error('offline'));const failed=await vm.runInContext(html.slice(start,end),c);assert.equal(failed.ok,false);
console.log('Build165: price fallback, compact error/empty states, retry recovery and stale-response guard passed');
