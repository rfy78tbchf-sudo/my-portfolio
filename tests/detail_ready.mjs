import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('  function detailCurrentWeightHtml('),html.indexOf('  function decisionImpactHtml('));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const metrics=(weight=20)=>({ok:true,position:{symbol:'TEST',weight_pct:weight},denominator:{value:10000,metric_id:'app_display_assets',label:'동일 계좌 범위'}});
function fixture(){
 const pending=deferred(),node={innerHTML:'',isConnected:true,appendChild(button){this.button=button}},calls=[];
 const c=vm.createContext({Promise,Error,Number,esc:String,weightPct:n=>n+'%',finiteMetric:x=>x==null?NaN:Number(x),document:{getElementById:()=>node,createElement:()=>({})},rpc:(name,args)=>{calls.push({name,...args});return pending.promise}});
 vm.runInContext(source,c);let active=true;return {c,pending,node,calls,start:()=>c.loadDetailCurrentWeight('TEST',()=>active),close:()=>{active=false}};
}
test('unresolved optional metrics is outside the detail render barrier',()=>{
 const entry=html.slice(html.indexOf('  function openSecurityDetail('),html.indexOf('  function empty('));
 const barrier=entry.slice(entry.indexOf('    Promise.all(['),entry.indexOf('    ]).then(function(results)'));
 assert.doesNotMatch(barrier,/get_live_decision_metrics/);
 assert.ok(entry.indexOf('loadDetailCurrentWeight(s.symbol,active)')>entry.indexOf('decisionForm.onsubmit'));
});
test('slow metrics leaves the rest of the detail alone, then fills the scoped value',async()=>{
 const f=fixture();const work=f.start();assert.match(f.node.innerHTML,/비중 확인 중/);
 assert.deepEqual(f.calls,[{name:'get_live_decision_metrics',p_symbol:'TEST',p_change_pct:0}]);
 f.pending.resolve(metrics());await work;assert.match(f.node.innerHTML,/20%/);assert.match(f.node.innerHTML,/동일 계좌 범위/);
});
for(const kind of ['network','invalid','wrong-symbol'])test(`${kind} failure has a local retry without showing zero`,async()=>{
 const f=fixture(),work=f.start();if(kind==='network')f.pending.reject(Error('offline'));else f.pending.resolve(kind==='invalid'?{ok:false}:{...metrics(),position:{symbol:'OTHER',weight_pct:30}});await work;
 assert.match(f.node.innerHTML,/평가 기준 확인 불가/);assert.doesNotMatch(f.node.innerHTML,/0%/);assert.equal(f.node.button.textContent,'비중 다시 확인');
 const retry=deferred();f.c.rpc=()=>retry.promise;f.node.button.onclick();assert.match(f.node.innerHTML,/비중 확인 중/);retry.resolve(metrics(25));await new Promise(resolve=>setImmediate(resolve));assert.match(f.node.innerHTML,/25%/);
});
for(const mode of ['closed','detached','new-comparison'])test(`late metrics cannot overwrite ${mode}`,async()=>{
 const f=fixture(),work=f.start();if(mode==='closed')f.close();if(mode==='detached')f.node.isConnected=false;if(mode==='new-comparison')f.node.innerHTML='현재 비교의 새 비중 35%';const before=f.node.innerHTML;
 f.pending.resolve(metrics());await work;assert.equal(f.node.innerHTML,before);
});
test('late failure cannot replace an authoritative comparison with retry UI',async()=>{
 const f=fixture(),work=f.start();f.node.innerHTML='현재 비교의 새 비중 35%';f.pending.reject(Error('offline'));await work;assert.equal(f.node.innerHTML,'현재 비교의 새 비중 35%');assert.equal(f.node.button,undefined);
});
