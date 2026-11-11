import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('  function openPerformanceDetail('),source.indexOf('  function bindDrilldown('));
const bindings=['data-decision-detail','data-performance-detail','data-sale-review'].map(attribute=>
  source.split('\n').find(line=>line.trimStart().startsWith(`document.querySelectorAll('[${attribute}]')`))
).join('\n');
const leaderStart=source.indexOf("    Array.prototype.forEach.call(document.querySelectorAll('[data-pnl-leader]')");
const leaders=source.slice(leaderStart,source.indexOf('    var pnlSort=',leaderStart));

function fixture(){
  const previousInput={id:'search',tagName:'INPUT'},calls=[],elements={};
  let context;
  function element(id,attributes){return {
    id,attributes,tagName:'BUTTON',getAttribute:key=>attributes[key]??null,
    focus(options){assert.equal(options.preventScroll,true);context.document.activeElement=this}
  }}
  elements.decision=element('review',{ 'data-decision-detail':'s0','data-review-entry':'true','data-review-decision':'saved-1','data-review-reason':'날짜 도래'});
  elements.performance=element('performance-row',{'data-performance-detail':'ARM'});
  elements.sale=element('sale-review',{'data-sale-review':'ARM','data-sale-currency':'USD'});
  elements.leader=element('summary-leader',{'data-pnl-leader':'ARM'});
  const selectors={
    '[data-decision-detail]':[elements.decision],
    '[data-performance-detail]':[elements.performance],
    '[data-sale-review]':[elements.sale],
    '[data-pnl-leader]':[elements.leader],
    '[data-stock-pnl-row]':[{getAttribute:()=> 'ARM',querySelector:()=>elements.performance}]
  };
  context=vm.createContext({
    document:{activeElement:previousInput,querySelectorAll:key=>selectors[key]||[]},
    live:{holdings:[{security_id:'s0',quantity:1},{security_id:'s0',quantity:2}],securityMap:{s0:{symbol:'ARM'}}},
    stockPnlQuery:'MRNA',stockPnlScope:'foreign',
    applyStockPnlFilter(){throw Error('opening a held contributor must preserve the list filter')},
    performanceReviewContext:symbol=>({symbol,period:'THIS_MONTH'}),
    openSecurityDetail(...args){calls.push({kind:'security',args,origin:context.document.activeElement})},
    openSaleReview(...args){calls.push({kind:'sale',args,origin:context.document.activeElement})}
  });
  vm.runInContext(helper+bindings+leaders,context);
  return {context,elements,calls,previousInput};
}

// A touch activation may leave a formerly focused search field active. Run the
// actual bound handlers without browser focus assistance and inspect the source
// captured at the moment the detail opens.
for(const name of ['decision','performance','sale','leader']){
  const f=fixture();f.elements[name].onclick();
  assert.equal(f.calls.length,1,`${name} opens once`);
  assert.equal(f.calls[0].origin,f.elements[name],`${name} captures its own return source`);
  assert.notEqual(f.calls[0].origin,f.previousInput,`${name} does not reopen the search keyboard on return`);
  assert.equal(f.context.stockPnlQuery,'MRNA');assert.equal(f.context.stockPnlScope,'foreign');
}

const review=fixture();review.elements.decision.onclick();
assert.equal(review.calls[0].args[0],'s0');
assert.deepEqual(JSON.parse(JSON.stringify(review.calls[0].args[3])),{securityId:'s0',decisionId:'saved-1',reason:'날짜 도래'});
const sale=fixture();sale.elements.sale.onclick();
assert.deepEqual(sale.calls[0].args,['ARM','USD']);
const performance=fixture();performance.elements.performance.onclick();
assert.equal(performance.calls[0].args[0],'s0','the same security in two accounts resolves once');
assert.equal(performance.calls[0].args[1].period,'THIS_MONTH','the selected-period context survives');
for(const kind of ['missing','ambiguous']){
  const f=fixture();
  f.context.live.holdings=kind==='missing'?[]:[{security_id:'s0',quantity:1},{security_id:'s1',quantity:1}];
  f.context.live.securityMap.s1={symbol:'ARM'};f.elements.performance.onclick();
  assert.equal(f.calls.length,0,`${kind} security identity never opens an arbitrary holding`);
  assert.equal(f.context.document.activeElement,f.previousInput,`${kind} identity does not steal focus`);
}
// Removed DOM subtrees retain their ancestor context. The same stock may appear
// in today's contributors, holdings, saved reviews and price watches at once.
const returnCode=source.slice(source.indexOf('  var detailReturnMark='),source.indexOf('  var detailNextCleanup='));
const parent=(tagName,id='',className='',parentElement=null)=>({tagName,id,className,parentElement});
const reviewParent=()=>parent('DIV','','review-home-item',parent('SECTION','','card review-home',parent('DETAILS','','home-reviews')));
function returnFixture(){
  let candidates=[],focused=null;
  const c=vm.createContext({document:{getElementById:()=>({querySelectorAll:()=>candidates})},setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(returnCode,c);
  function row(section,key='data-security-id',visible=true){
    const classes=new Set();
    return {parentElement:section,isConnected:false,tagName:key==='data-security-id'?'DIV':'BUTTON',
      hasAttribute:attribute=>attribute===key,getAttribute:attribute=>attribute===key?'s0':null,
      getClientRects:()=>visible?[1]:[],matches:()=>true,
      focus(options){assert.equal(options.preventScroll,true);focused=this},
      classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},classes};
  }
  return {c,row,set candidates(value){candidates=value},get focused(){return focused}};
}
for(const [originalId,otherId] of [['homeHoldings','homeToday'],['homeToday','homeHoldings']]){
  const f=returnFixture(),old=f.row(parent('SECTION',originalId)),other=f.row(parent('SECTION',otherId)),replacement=f.row(parent('SECTION',originalId));
  f.candidates=[other,replacement];f.c.restoreDetailReturnFocus(old);
  assert.equal(f.focused,replacement,'a same-symbol replacement stays in its original home section');
  assert.equal(other.classes.size,0);assert.ok(replacement.classes.has('detail-return-highlight'));
}
for(const originIsReview of [true,false]){
  const f=returnFixture(),review=f.row(reviewParent(),'data-decision-detail'),watch=f.row(parent('SECTION','homePriceWatch'),'data-decision-detail');
  const old=f.row(originIsReview?reviewParent():parent('SECTION','homePriceWatch'),'data-decision-detail');
  f.candidates=originIsReview?[watch,review]:[review,watch];f.c.restoreDetailReturnFocus(old);
  assert.equal(f.focused,originIsReview?review:watch,'review and watch buttons with the same stock ID remain distinct');
}
for(const hiddenOriginalSection of [false,true]){
  const f=returnFixture(),old=f.row(parent('SECTION','homeHoldings')),other=f.row(parent('SECTION','homeToday'));
  f.candidates=hiddenOriginalSection?[other,f.row(parent('SECTION','homeHoldings'),'data-security-id',false)]:[other];
  f.c.restoreDetailReturnFocus(old);
  assert.equal(f.focused,null,'a missing or hidden original section never sends focus to another occurrence');
}
{
  const f=returnFixture(),old=f.row(reviewParent(),'data-decision-detail'),watch=f.row(parent('SECTION','homePriceWatch'),'data-decision-detail'),review=f.row(reviewParent(),'data-decision-detail');
  review.isConnected=true;review.closest=()=>null;watch.isConnected=true;watch.closest=()=>null;
  const candidates=[watch,review];f.candidates=candidates;
  const getElement=f.c.document.getElementById;
  f.c.document.getElementById=id=>id==='detailModal'?{classList:{add(){}}}:getElement(id);
  f.c.document.querySelectorAll=()=>candidates;
  Object.assign(f.c,{detailNextCleanup:null,detailEpoch:0,decisionHomeDirty:true,currentTab:'home',detailReturnState:{y:420,focus:old},
    allowDetailLeave:()=>true,render:preserve=>assert.equal(preserve,true),leaveDetailHistory(){},window:{scrollTo(x,y){assert.equal(x,0);assert.equal(y,420)}}});
  vm.runInContext(source.slice(source.indexOf('  function closeSecurityDetail('),source.indexOf('  function performanceReviewContext(')),f.c);
  f.c.closeSecurityDetail();
  assert.equal(f.focused,review,'saving then returning also resolves the original review section before focusing');
}
console.log('Build209: touch return sources and section identity, preserved period/currency, unique holding lookup, hidden/missing destinations passed');
