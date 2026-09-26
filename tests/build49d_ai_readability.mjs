import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const backend=readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const scope=vm.createContext({Deno:{env:{get:()=>''}}});
vm.runInContext(stripTypeScriptTypes(backend.slice(backend.indexOf('\n')+1,backend.indexOf('\nDeno.serve('))),scope);
const focus=vm.runInContext('answerFocus',scope),select=vm.runInContext('questionContext',scope);
assert.equal(focus('내 포트폴리오에서 지금 확인할 위험은 무엇인가?'),'risk');
assert.equal(focus('최근 한 달 왜 벌었어?'),'performance');
assert.equal(focus('SOXX 매도 실현손익은?'),'realized');
assert.equal(focus('ARM을 계속 보유할 논리가 있어?'),'thesis');
const context={as_of:'2026-09-26',account_scope:{broker_account_overlap_verified:false},confidence:'estimated',
  risk:{official_assets_krw:60_000_000,largest_symbol:'ARM',largest_krw:15_000_000,top_three_krw:35_000_000},
  holdings:[{security:{symbol:'ARM',name:'예시 종목'},quantity:30,valuation_krw:15_000_000}],
  reconciliation:{quantity_total:10,quantity_matched:5},pending_settlement_events:[{symbol:'META'}],
  thesis:null,ledger_realized:{items:[{symbol:'SOXX'}]},
  period_evidence:{investment_result_usable:false,cash_bridge_gaps:[{difference_krw:100}]},
  reliable_observed_period:{partial:true},selected_security:{symbol:'ARM'}};
const risk=select(context,'risk');
assert.equal(risk.risk.largest_pct_of_kb_response,25);
assert.equal(risk.risk.top_three_pct_of_kb_response,58.33);
assert.deepEqual(Array.from(risk.unsettled_symbols),['META']);
assert.equal('thesis' in risk,false,'missing thesis must not dominate a risk answer');
assert.equal('ledger_realized' in risk,false,'realized ledger must not dominate a risk answer');
assert.equal('period_evidence' in risk,false,'performance evidence must not dominate a risk answer');
assert.equal(select({...context,risk:{...context.risk,largest_krw:null}},'risk').risk.largest_pct_of_kb_response,null);
assert.equal(select(context,'performance').period_evidence.investment_result_usable,false);
assert.equal(select(context,'realized').ledger_realized.items[0].symbol,'SOXX');
const style=vm.runInContext('answerStyle',scope)('risk');
assert.match(style,/가장 큰 위험:/);assert.match(style,/근거:/);assert.match(style,/450자/);
assert.match(backend,/focusPolicy\(focus\)/);

const frontend=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const start=frontend.indexOf('  function renderAiAnswer('),end=frontend.indexOf('  async function ask(',start);
assert.ok(start>0&&end>start);
function element(tag){return {tag,children:[],style:{},_text:'',
  appendChild(child){this.children.push(child);return child},
  set textContent(value){this._text=String(value);this.children=[]},
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}}}
const dom=vm.createContext({document:{createElement:element,createTextNode:text=>({textContent:text})}});
vm.runInContext(frontend.slice(start,end),dom);
const render=vm.runInContext('renderAiAnswer',dom);
let output=element('div');render(output,'가장 큰 위험: ARM 비중이 높습니다.\n근거: KB 조회 총자산 대비 25%.\n다음 확인: 비중 목표를 점검하세요.');
assert.equal(output.children.length,3);
assert.equal(output.children[0].children[0].tag,'strong');
assert.match(output.textContent,/KB 조회 총자산 대비 25%/);
output=element('div');render(output,'핵심: '+('긴 설명 '.repeat(150))+'\n근거: <script>alert(1)</script>');
assert.equal(output.children[1].tag,'details','a long answer should be expandable, not dominate the phone');
assert.match(output.children[1].textContent,/<script>/,'full answer remains available as text');
assert.ok(!output.children.some(x=>x.tag==='script'),'model text never becomes HTML');
console.log('AI focus, account-scope evidence, mobile concise layout and safe expansion passed');
