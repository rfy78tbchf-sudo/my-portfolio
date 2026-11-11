import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const s=fs.readFileSync(process.env.CONTRIBUTION_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const start=s.indexOf("    Array.prototype.forEach.call(document.querySelectorAll('[data-pnl-leader]')");
const end=s.indexOf("    var pnlSort=",start);
for(const held of [true,false]){
 let opened=0,filtered=0,focused=null,scrolled=0;
 const search={value:'MRNA'};
 const button={getAttribute:()=> 'ARM',focus:()=>{focused='leader'}};
 const detail={click:()=>{opened++;assert.equal(focused,'leader','explicit focus supports touch browsers')}};
 const row={getAttribute:()=> 'ARM',querySelector:()=>held?detail:null,setAttribute(){},scrollIntoView(){scrolled++},focus(){focused='row'}};
 const c=vm.createContext({stockPnlQuery:'MRNA',stockPnlScope:'foreign',applyStockPnlFilter(){filtered++},
  live:{holdings:[{security_id:'s0',quantity:1}],securityMap:{s0:{symbol:'ARM'}}},performanceReviewContext:()=>null,
  openSecurityDetail(id){assert.equal(id,'s0');opened++;assert.equal(focused,'leader','summary leader remains the return origin')},
  document:{querySelectorAll:q=>q==='[data-pnl-leader]'?[button]:[row],getElementById:()=>search}});
 if(s.includes('  function openPerformanceDetail('))vm.runInContext(s.slice(s.indexOf('  function openPerformanceDetail('),s.indexOf('  function bindDrilldown(')),c);
 vm.runInContext(s.slice(start,end),c);button.onclick();
 assert.equal(opened,held?1:0);assert.equal(filtered,held?0:1);
 assert.equal(c.stockPnlQuery,held?'MRNA':'');assert.equal(c.stockPnlScope,held?'foreign':'all');
 assert.equal(search.value,held?'MRNA':'');assert.equal(scrolled,held?0:1);
}
console.log('Build199: held leader preserves filters and origin focus; closed leader reveals its existing row');
