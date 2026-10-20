import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('index.html','utf8');
const p={ok:true,period:'THIS_MONTH',items:[{symbol:'A',name:'A',pnl_krw:10,pnl_local:10,currency:'KRW'},{symbol:'B',name:'B',pnl_krw:999,pnl_local:999,reason:'시작 보유수량 확인 필요'},{symbol:'C',pnl_krw:'NaN'},{symbol:'D',pnl_krw:''}],pnl_krw:10,complete:false,krw_included_count:1,candidate_count:4};
const c=vm.createContext({live:{stockPnl:p},stockView:'total',stockPeriod:'THIS_MONTH',stockPnlSort:'impact',period:'오늘',esc:String,signedMoney:String,num:String,cls:()=>'',stockMark:()=>'',stockViewButtons:()=>'',stockPeriodButtons:()=>'',stockPeriodLabel:()=> '이번 달',stockTotalPartsHtml:()=>'',kstStamp:()=>''});
vm.runInContext(source.slice(source.indexOf('  function sortedStockPnl('),source.indexOf('  function stockPeriodLabel('))+source.slice(source.indexOf('  function stockPeriodPerformance('),source.indexOf('  function livePerformance(')),c);

p.items=[{symbol:'SOXL',name:'DIREXION SEMICONDUCT LONG NAME',currency:'USD',pnl_krw:50},{symbol:'ARM',currency:'USD',pnl_krw:-100},{symbol:'005930',name:'삼성전자',currency:'KRW',pnl_krw:30},{symbol:'SMALL',currency:'USD',pnl_krw:10},{symbol:'UNKNOWN',reason:'missing',pnl_krw:999}];
const view=c.stockPeriodPerformance(),leaders=view.match(/<section class="card pnl-leaders">[\s\S]*?<\/section>/)[0];
assert.equal((leaders.match(/data-pnl-leader=/g)||[]).length,3);
assert.ok(leaders.indexOf('data-pnl-leader="ARM"')<leaders.indexOf('data-pnl-leader="SOXL"'));
assert.match(leaders,/>SOXL</);assert.match(leaders,/>삼성전자</);
assert.doesNotMatch(leaders,/LONG NAME|UNKNOWN|SMALL/);assert.match(view,/일부 미계산/);
assert.match(view,/ISA·현금 별도/);assert.match(view,/수익 종목 합계/);
console.log('Build207: three largest absolute contributors, short foreign ticker, domestic name, partial scope and unchanged breakdown passed');
