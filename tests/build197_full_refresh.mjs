import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
function fixture(overrides={},fail=false){
 const previous={authOwner:1,accounts:[{id:'a'}],performancePeriod:'1M',startupHomeDataDay:'2026-10-12',startupTodayDataDay:'2026-10-12',performance:{old:true},homeChart:{old:true},performanceGate:{old:true},todayGate:{old:true},...overrides};let release;
 const c=vm.createContext({live:previous,liveAuthEpoch:1,liveLoadEpoch:0,performanceRequestEpoch:0,realizedRequestEpoch:0,session:{},mode:'live',period:'1M',render(){},kstDate:()=> '2026-10-12',
 rest:async path=>path.startsWith('accounts?')?[{id:'a'}]:path.startsWith('daily_account_snapshots?')?[{total_assets:200}]:[],
 rpc:async name=>{if(name==='get_live_home_chart'&&fail)throw Error('offline');return {fresh:true}}
 });vm.runInContext(source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp(')),c);
 c.loadLiveDetails=(core,target,active)=>new Promise(resolve=>{release=()=>c.loadStartupHomeData(target,active,c.period,c.performanceRequestEpoch).then(resolve)});
 return {c,previous,release:()=>release()};
}
const tick=()=>new Promise(r=>setImmediate(r));
const f=fixture(),pending=f.c.loadLiveOnce();await tick();
assert.equal(f.c.live.snapshots[0].total_assets,200,'new balance is not held back by performance');
assert.equal(f.c.live.homeChart,f.previous.homeChart,'confirmed chart stays while full refresh performance is pending');
assert.equal(f.c.live.startupHomePrevious,true,'retained performance must be labelled as previous');
f.release();await pending;assert.equal(f.c.live.homeChart.fresh,true);assert.equal(f.c.live.startupHomePrevious,false);
const failed=fixture({},true),failure=failed.c.loadLiveOnce();await tick();failed.release();await failure;
assert.equal(failed.c.live.homeChart.old,true);assert.equal(failed.c.live.startupHomeError,true);assert.ok(failed.c.live.startupHomeRetained.includes('자산 추이'));assert.equal(failed.c.live.startupHomePrevious,false);
for(const overrides of [{authOwner:2},{accounts:[{id:'other'}]},{startupHomeDataDay:'2026-10-11',startupTodayDataDay:'2026-10-11'},{performancePeriod:'3M'}]){
 const g=fixture(overrides),p=g.c.loadLiveOnce();await tick();assert.equal(g.c.live.homeChart,null,'different owner/account/day/period cannot lend performance');g.release();await p;
}
console.log('Build197: new balances with retained labelled performance, fresh replacement, failure retention and owner/account/day/period isolation passed');
