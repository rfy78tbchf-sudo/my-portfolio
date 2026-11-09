import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let source=readFileSync('tests/refresh_critical_path253.mjs','utf8');
const rows=Number(process.env.SALES_ROWS||100);if(![100,1000].includes(rows))throw Error('unsupported rows');
source=source.replace('window.__dailyTest={',`window.__probe=async function(p,scope,kind){
 performanceAssetScope=scope;
 if(kind==='cold'){live.stockPnlCache={};live.stockPnlCacheTimes={};live.stockPnl=null;live.stockRealized=null;live.stockRealizedPeriod=null;live.stockRealizedLoading=false;}
 var start=performance.now();
 if(kind==='rapid'){await Promise.all(['1W','1M','3M','ALL'].map(function(v){return changeStockPeriod(v,true)}));p='ALL';}
 else await changeStockPeriod(p,true);
 while(live.stockRealizedLoading||liveReadsActive||liveReadQueue.length)await new Promise(function(r){setTimeout(r,5)});
 await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})});
 var node=document.querySelector('.pnl-subtotal strong');
 if(!live.stockPnl||live.stockPnl.period!==p||live.stockPnl.pnl_krw!==90000||!node||!node.textContent.includes('90,000'))throw Error('Incorrect rendered result');
 if(scope==='all'&&!document.querySelector('.performance-hero').textContent.includes('전체 손익 확인 중'))throw Error('Whole-account trust marker lost');
 return {ms:performance.now()-start,period:p,scope,kind,rows:live.stockRealized.items.length,complete:live.stockPnl.complete};
 };window.__dailyTest={`);
source=source.replace('var originalDiagnosticRender=render,diagnosticRenderDepth=0;', 'var originalDiagnosticRender=render,diagnosticRenderDepth=0;');
source=source.replace(/  render=function\(preserve\).*?\n/, '');
source=source.replace('get_live_realized_sales:{ok:true,items:[],period:body.p_period}',`get_live_realized_sales:{ok:true,items:Array.from({length:${rows}},(_,i)=>({id:'sale-'+i,transaction_id:'sale-'+i,symbol:'SYN'+(i%4),name:'Synthetic sale',currency:'KRW',status:'calculated',realized_local:1,historical_krw_estimate:1,quantity:1,sell_date:day,gross_amount:101,allocated_cost:100})),period:body.p_period}`);
const start=source.indexOf('    const samples=[];'),end=source.indexOf('    assert.deepEqual(forbidden,[]);',start);
if(start<0||end<start)throw Error('Missing test loop');
source=source.slice(0,start)+`    const samples=[];
    for(const scope of ['stocks','all'])for(const p of ['1W','1M','3M','ALL'])for(let i=0;i<3;i++)for(const kind of ['cold','repeat']){
      const n=calls.length;const result=await page.evaluate(([p,s,k])=>window.__probe(p,s,k),[p,scope,kind]);
      const delta=calls.slice(n);assert.equal(result.rows,${rows});assert.equal(result.complete,false);
      if(kind==='repeat')assert.equal(delta.filter(x=>x.path.endsWith('/get_live_period_stock_pnl')).length,0);
      samples.push({...result,requests:delta.length,pnlRequests:delta.filter(x=>x.path.endsWith('/get_live_period_stock_pnl')).length});
    }
    // Force misses before rapid switching and verify the final period after all responses.
    await page.evaluate(()=>{live.stockPnl=null;live.stockPnlCache={};live.stockPnlCacheTimes={}}).catch(()=>{});
    const rapidStart=calls.length;const result=await page.evaluate(()=>window.__probe('ALL','stocks','rapid'));const rapidCalls=calls.slice(rapidStart);result.requests=rapidCalls.length;result.pnlRequests=rapidCalls.filter(x=>x.path.endsWith('/get_live_period_stock_pnl')).length;assert.ok(result.pnlRequests<=2);samples.push(result);
`+source.slice(end);
// Scope variables are private; clear for rapid switching inside the injected closure instead.
source=source.replace("if(kind==='rapid'){await", "if(kind==='rapid'){live.stockPnl=null;live.stockPnlCache={};live.stockPnlCacheTimes={};await");
source=source.replace(/    await page.evaluate\(\(\)=>\{live.stockPnl=null;.*?\n/, '');
const file='tests/.period-payload-'+randomUUID()+'.mjs';
try{writeFileSync(file,source);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}
