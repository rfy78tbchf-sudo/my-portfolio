import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.env.UI_SOURCE||'index.html','utf8');
const fn=html.slice(html.indexOf('  function stockRealizedEvidenceHtml('),html.indexOf('  function stockTotalParts('));
const helpers=html.slice(html.indexOf('  function esc('),html.indexOf('  function esc(')+2000).split('\n').filter(x=>/^  function (esc|num|price)\(/.test(x)).join('\n');
const before=fn.replace('    var quantityFormat=new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format;\n','').replace("(isFinite(Number(s.quantity))?quantityFormat(Number(s.quantity)):'-')",'num(s.quantity,6)');
const values=[null,undefined,'',0,-0,NaN,Infinity,-Infinity,'bad',1/3,-1234567.123456789,1e-8,1e20,'12.3456789'];
for(const locale of ['en-US','ko-KR','de-DE','ar-EG']){
 const context={Intl:{NumberFormat:class{constructor(_,opts){return new Intl.NumberFormat(locale,opts)}}}};
 const c=vm.createContext(context);vm.runInContext(helpers+"\nnum=function(n,d){n=Number(n);return isFinite(n)?n.toLocaleString('"+locale+"',{maximumFractionDigits:d==null?2:d}):'-'};"+fn+';var after=stockRealizedEvidenceHtml;'+before+';var before=stockRealizedEvidenceHtml;',c);
 for(const quantity of values){c.x={currency:'KRW',known:1,count:1,localKnown:1,amount:1,local:1,sales:[{trade_date:'2026-11-09',quantity}],issues:{}};assert.equal(vm.runInContext('after(x)',c),vm.runInContext('before(x)',c));}
 c.x={currency:'USD',known:0,count:1500,localKnown:1500,amount:null,local:100,estimated:1,issues:{'<unknown>':1500},sales:Array.from({length:1500},(_,i)=>({trade_date:'2026-11-09',quantity:i/7,status:i%2?'settlement_pending':'estimated_average',settlement_date:'2026-11-12',average_cost_estimate:{basis_date:'2026-11-08',average_cost:12.34,costs_final:false},currency:'USD'}))};assert.equal(vm.runInContext('after(x)',c),vm.runInContext('before(x)',c));
}
console.log('60 complete evidence HTML comparisons passed across four locales, nonfinite inputs and 1500 mixed-status sales');
