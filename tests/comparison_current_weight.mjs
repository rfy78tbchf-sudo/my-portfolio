import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Isolated production renderer/handlers, without network or account writes.
const html=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
const helper=section('  function detailCurrentWeightHtml(', '  function decisionImpactHtml(');
const denominator={metric_id:'app_display_assets',value:100000,label:'KB 자동계좌 + 최신 ISA 총액 (평가시각 미확인)'};
const metrics=(weight=23.4)=>({ok:true,position:{symbol:'TEST',weight_pct:weight,value:23400},denominator});
const comparison=(weight=23.4)=>({ok:true,hold:{weight_pct:weight},denominator,reduce:{mode:'integer_shares'},observation_at:'2026-10-09T00:00:00Z'});
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context=vm.createContext({esc,weightPct:n=>Number(n).toFixed(1)+'%',finiteMetric:v=>v==null||v===''?NaN:Number(v)});
vm.runInContext(helper,context);
const render=x=>context.detailCurrentWeightHtml(x,'TEST');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}

test('current percentage and basis reuse server scope, including zero',()=>{
  assert.match(render(metrics()),/현재 비중 <b>23\.4%<\/b>/);
  assert.match(render(metrics()),/KB 자동계좌 \+ 최신 ISA 총액 \(평가시각 미확인\) 기준/);
  assert.match(render(metrics(0)),/0\.0%/);
  assert.equal(render(metrics('23.4')),render(comparison(23.4)));
  const unverified={...metrics(),denominator:{...denominator,label:'앱 합산 자산 (ISA 포함 여부 미확인)'}};
  assert.match(render(unverified),/ISA 포함 여부 미확인/);
});

test('missing, invalid, mismatched and unavailable data stays a neutral dash',()=>{
  const invalid=[null,{}, {ok:false}, {...metrics(),ok:false}, {...metrics(),position:{symbol:'OTHER',weight_pct:23.4}}];
  for(const value of [null,undefined,'',' ',false,true,NaN,Infinity,-1])invalid.push({...metrics(),position:{symbol:'TEST',weight_pct:value}});
  for(const value of [null,undefined,'',' ',false,0,-1,NaN,Infinity])invalid.push({...metrics(),denominator:{...denominator,value}});
  for(const label of [null,undefined,'',' '])invalid.push({...metrics(),denominator:{...denominator,label}});
  invalid.push({...metrics(),denominator:{...denominator,metric_id:'other_scope'}},{...metrics(),denominator:null},{...metrics(),denominator:undefined});
  for(const value of invalid){assert.match(render(value),/<b>—<\/b>/);assert.doesNotMatch(render(value),/NaN|Infinity|0\.0%/);}
});

test('server denominator text is escaped',()=>{
  const out=render({...metrics(),denominator:{...denominator,label:'<img src=x onerror=alert(1)>'}});
  assert.doesNotMatch(out,/<img/);assert.match(out,/&lt;img/);
});

test('detail load reads exact scenario metrics for the selected symbol and tolerates failure',async()=>{
  const source=section("      rpc('get_live_decision_metrics',{p_symbol:known.symbol,p_change_pct:0})",'\n    ]).then');
  const calls=[];const ctx=vm.createContext({known:{symbol:'TEST'},rpc:async(name,args)=>{calls.push({name,...args});return metrics();}});
  const result=await vm.runInContext(source,ctx);assert.match(render(result),/23\.4%/);
  assert.deepEqual(calls,[{name:'get_live_decision_metrics',p_symbol:'TEST',p_change_pct:0}]);
  ctx.rpc=async()=>{throw Error('offline')};assert.equal(await vm.runInContext(source,ctx),null);
});

test('current value stays beside the input, outside extra disclosure and out of editable state',()=>{
  const source=section('        \'<div class="choice-target">', '        \'<details class="more-list choice-settings">').trim().replace(/\+\s*$/,'');
  context.results=[null,null,null,null,metrics()];context.s={symbol:'TEST'};
  const out=vm.runInContext('('+source+')',context);
  assert.match(out,/choice-weight-entry/);assert.match(out,/현재 비중 <b>23\.4%/);
  assert.ok(out.indexOf('detailWeightTarget')<out.indexOf('id="detailCurrentWeight"')&&out.indexOf('id="detailCurrentWeight"')<out.indexOf('detailWeightRun'));
  assert.doesNotMatch(out,/<details/);assert.match(out,/aria-describedby="detailCurrentWeight"/);
  const input=out.match(/<input[^>]*>/)[0];assert.match(input,/min="0" max="100" step="0.1"/);assert.doesNotMatch(input,/\bvalue=|disabled/);
  assert.match(html,/\.choice-weight-entry\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

function handlers(){
  const elements=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,scrollIntoView(){},insertAdjacentElement(){},remove(){}});return elements.get(id)};
  const ctx=vm.createContext({
    document:{getElementById:el,createElement:()=>el('created')},s:{symbol:'TEST'},active:()=>true,
    esc,weightPct:n=>Number(n).toFixed(1)+'%',finiteMetric:v=>v==null||v===''?NaN:Number(v),
    comparisonEpoch:0,analysisEpoch:0,lastComparison:null,lastComparisonDirty:false,lastDetailAnalysisId:null,lastAnalysisComparison:false,
    comparisonHtml:()=>'<div>comparison</div>',showComparisonNext(){},money:String,signedMoney:String,kstStamp:String,
    rpc:async name=>name==='get_live_choice_comparison'?comparison(18.2):metrics(19.7),
    thesisSaved:true,thesisVersion:1,pendingDetailRequest:null,edgeSync:async()=>{},loadLive:async()=>{},
    live:{},liveError:null,runDetailAnalysis:async()=>({ok:true}),
  });
  vm.runInContext(helper+section('      var scenarioClick=async function(kind){','      var pendingDetailRequest=')+
    section("      var fresh=document.getElementById('detailFreshReview');if(fresh)fresh.onclick=",'      function bindThesisPeriods()'),ctx);
  el('detailWeightTarget').value='10';el('detailDown').value='-10';el('detailUp').value='10';el('detailPriceChange').value='-10';
  el('detailCurrentWeight').innerHTML=render(metrics());
  return {ctx,el};
}

test('comparison refreshes from hold weight without changing target, including a zero target',async()=>{
  const f=handlers();f.el('detailWeightTarget').value='0';await f.ctx.scenarioClick('weight');
  assert.match(f.el('detailCurrentWeight').innerHTML,/18\.2%/);assert.equal(f.el('detailWeightTarget').value,'0');
  assert.equal(f.ctx.lastComparison.targetPct,0);
});

for(const active of [true,false])test(`late comparison cannot change current weight after ${active?'input invalidation':'navigation'}`,async()=>{
  const f=handlers(),pending=deferred(),before=f.el('detailCurrentWeight').innerHTML;
  f.ctx.rpc=()=>pending.promise;const work=f.ctx.scenarioClick('weight');
  if(active)f.ctx.comparisonEpoch++;else f.ctx.active=()=>false;
  pending.resolve(comparison(5));await work;assert.equal(f.el('detailCurrentWeight').innerHTML,before);
});

test('unsequenced price-only request cannot overwrite comparison weight',async()=>{
  const f=handlers(),before=f.el('detailCurrentWeight').innerHTML;
  f.ctx.rpc=async()=>({...metrics(1),scenario:{impact_krw:-1}});await f.ctx.scenarioClick('price');
  assert.equal(f.el('detailCurrentWeight').innerHTML,before);
});

for(const target of ['','0','10'])test(`fresh review updates current basis for ${target===''?'no comparison':target+'% target'}`,async()=>{
  const f=handlers();f.el('detailWeightTarget').value=target;await f.el('detailFreshReview').onclick();
  assert.match(f.el('detailCurrentWeight').innerHTML,target===''?/19\.7%/:/18\.2%/);
  assert.equal(f.el('detailWeightTarget').value,target);
});

test('late fresh-review response cannot restore old current weight',async()=>{
  const f=handlers(),pending=deferred(),before=f.el('detailCurrentWeight').innerHTML;
  f.ctx.rpc=()=>pending.promise;const work=f.el('detailFreshReview').onclick();await Promise.resolve();await Promise.resolve();
  f.ctx.comparisonEpoch++;pending.resolve(comparison(5));await work;
  assert.equal(f.el('detailCurrentWeight').innerHTML,before);
});
