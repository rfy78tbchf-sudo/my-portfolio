import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const samples=[];
for(let run=0;run<3;run++){
 const start=performance.now(),time={};
 const c=vm.createContext({session:{},live:null,liveError:null,mode:'live',liveAuthEpoch:1,liveLoadEpoch:0,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'1M',realizedPeriod:'1M',realizedAccount:'ALL',periodTouched:false,realizedPeriodExplicit:false,lastLiveLoadAt:0,kstDate:()=> '2026-10-21',kstDaysAgo:()=> '2026-10-01',applyUiSettings(){},checkPriceAlerts(){},loadSwingPrices:async()=>{},
 render(){const ms=Math.round(performance.now()-start);if(!time.asset&&(c.loadLiveOnce.quickAsset||c.live?.accounts.length))time.asset=ms;if(!time.trend&&c.live?.homeChart)time.trend=ms}});
 vm.runInContext(section('  var liveReadQueue=','  function rest('),c);
 c.rest=path=>c.queueLiveRead(async()=>{await delay(path.startsWith('live_holding_display_basis')?180:40);return path.startsWith('accounts?')?[{id:'a'}]:path.startsWith('daily_account_snapshots?')?[{total_assets:100}]:[]});
 c.rpc=name=>name==='reconcile_live_cash_flows'?delay(250).then(()=>({ok:true})):c.queueLiveRead(async()=>{await delay(40);return name==='get_live_current_account_scope'?{ok:true,current_display_total:100}:name==='get_app_settings'?{}:{ok:true,items:[]}});
 vm.runInContext(section('  function loadLiveOnce(','  function showApp('),c);
 await c.loadLiveOnce();time.complete=Math.round(performance.now()-start);samples.push(time);
}
console.log(JSON.stringify({basis:'Synthetic three-read queue: 40ms reads, 180ms valuation, 250ms reconciliation; not live KB or iPhone measurements',samples,median:Object.fromEntries(['asset','trend','complete'].map(k=>[k,samples.map(s=>s[k]).sort((a,b)=>a-b)[1]]))}));
