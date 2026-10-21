import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  function loadLiveOnce('),source.indexOf('  function showApp('));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const pending={},calls=[],paints=[];
 const c=vm.createContext({session:{},mode:'live',live:null,liveError:null,liveAuthEpoch:1,liveLoadEpoch:0,performanceRequestEpoch:0,realizedRequestEpoch:0,period:'1M',render(){paints.push(c.loadLiveOnce.quickAsset?.total)},
 rest:path=>{const name=path.split('?')[0];calls.push(name);return new Promise((resolve,reject)=>pending[name]={resolve,reject})},
 rpc:name=>{calls.push(name);return new Promise((resolve,reject)=>pending[name]={resolve,reject})}});
 vm.runInContext(block,c);c.loadLiveDetails=async()=>{};
 return {c,pending,calls,paints};
}
function release(f,name,v){f.pending[name].resolve(v)}
function finish(f){for(const [k,p] of Object.entries(f.pending)){if(k==='accounts'||k==='get_live_current_account_scope')continue;p.resolve(k==='daily_account_snapshots'?[{total_assets:100}]:[])}}
const f=fixture(),p=f.c.loadLiveOnce();
release(f,'accounts',[{id:'a'}]);release(f,'get_live_current_account_scope',{ok:true,current_display_total:120});await tick();
assert.equal(f.c.live,null,'whole account bundle still pending');assert.equal(f.c.loadLiveOnce.quickAsset.total,120,'confirmed total appears before holdings/basis');
assert.equal(f.calls.filter(x=>x==='get_live_current_account_scope').length,1,'no duplicate amount query');assert.equal(f.calls.filter(x=>x==='accounts').length,1);
finish(f);await p;assert.equal(f.c.loadLiveOnce.quickAsset,null);assert.equal(f.c.live.accountScope.current_display_total,120);
for(const bad of [null,{}, {ok:false,current_display_total:120},{ok:true,current_display_total:null},{ok:true,current_display_total:''},{ok:true,current_display_total:'bad'}]){
 const x=fixture(),p=x.c.loadLiveOnce();release(x,'accounts',[{id:'a'}]);release(x,'get_live_current_account_scope',bad);await tick();assert.equal(x.c.loadLiveOnce.quickAsset,null);finish(x);await p;
}
const failed=fixture(),fp=failed.c.loadLiveOnce();failed.pending.holdings.reject(Error('offline'));await tick();release(failed,'accounts',[{id:'a'}]);release(failed,'get_live_current_account_scope',{ok:true,current_display_total:999});finish(failed);await fp;await tick();assert.equal(failed.c.loadLiveOnce.quickAsset,null,'late amount cannot mask a core error');assert.equal(failed.c.liveError,'offline');
const other=fixture(),op=other.c.loadLiveOnce();other.c.liveAuthEpoch++;release(other,'accounts',[{id:'a'}]);release(other,'get_live_current_account_scope',{ok:true,current_display_total:999});finish(other);await op;assert.equal(other.c.live,null);assert.equal(other.c.loadLiveOnce.quickAsset,null,'former session cannot publish');
// Enrichment waits for startup, and does not duplicate the startup request bundle.
let releaseHome,extra=0;const home=new Promise(r=>releaseHome=r);
const d=vm.createContext({liveError:null,mode:'live',period:'1M',periodTouched:true,realizedPeriodExplicit:true,performanceRequestEpoch:1,realizedPeriod:'1M',realizedAccount:'ALL',applyUiSettings(){},
 rpc:async name=>{if(!['reconcile_live_cash_flows','get_app_settings'].includes(name))extra++;return {}},rest:async()=>{extra++;return []}});
vm.runInContext(block,d);const target={};d.live=target;d.loadHomeReviewData=async()=>[[],[],[]];d.loadStartupHomeData=()=>home;
let active=true;const detail=d.loadLiveDetails([[],[],[],[],[],[],[],{}],target,()=>active);await tick();assert.equal(extra,0,'analysis requests do not compete with the home bundle');active=false;releaseHome([]);await detail;assert.equal(extra,0,'logout cancels deferred enrichment');
console.log('Build215: early authoritative total, no duplicate queries, unknown values, late failure, owner isolation and staged enrichment passed');
