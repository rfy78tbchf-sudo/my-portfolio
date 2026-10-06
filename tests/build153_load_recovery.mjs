import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('index.html','utf8');
const c=vm.createContext({session:{accessToken:'a'},setTimeout:fn=>fn()});
vm.runInContext(source.slice(source.indexOf('  function readFetch('),source.indexOf('  function rest(')),c);
let calls=0;c.authFetch=async()=>{if(++calls===1)throw Object.assign(new Error('aborted'),{name:'AbortError'});return 'ok'};
assert.equal(await c.readFetch('/read',{},9000),'ok');assert.equal(calls,2);
calls=0;c.authFetch=async()=>{calls++;throw Object.assign(new Error('aborted'),{name:'AbortError'})};await assert.rejects(c.readFetch('/read',{},9000));assert.equal(calls,2);
calls=0;c.authFetch=async()=>{calls++;return {status:403}};assert.equal((await c.readFetch('/read',{},9000)).status,403);assert.equal(calls,1);
calls=0;c.authFetch=async()=>{calls++;c.session=null;throw Object.assign(new Error('aborted'),{name:'AbortError'})};await assert.rejects(c.readFetch('/read',{},9000));assert.equal(calls,1);
// Full initial load: failed secondary reads must not hide successful account reads.
Object.assign(c,{live:null,liveError:null,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'오늘',realizedPeriod:'오늘',realizedAccount:'all',periodTouched:false,realizedPeriodExplicit:false,compactMode:false,hideZeroHoldings:false,applyUiSettings(){},kstDaysAgo:()=> '2026-09-01',lastLiveLoadAt:0,checkPriceAlerts(){},mode:'live',render(){},loadSwingPrices:async()=>null});
c.rest=async path=>path.startsWith('accounts?')?[{id:'account'}]:path.startsWith('holdings?')?[{quantity:1}]:[];
c.rpc=async name=>{if(name==='get_app_settings')return {};if(name==='reconcile_live_cash_flows')return {ok:true};throw new Error('secondary timeout')};
vm.runInContext(source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp(')),c);
await c.loadLiveOnce();assert.equal(c.live.accounts[0].id,'account');assert.equal(c.live.holdings[0].quantity,1);assert.equal(c.live.performance,null);assert.equal(c.liveError,null);
// Critical account failure is still reported, never fabricated as a successful empty account.
c.live=null;c.rest=async()=>{throw new Error('core unavailable')};await c.loadLiveOnce();assert.equal(c.liveError,'core unavailable');
console.log('Build153: bounded read retry, auth/session isolation, secondary failure isolation, critical failure preserved');
