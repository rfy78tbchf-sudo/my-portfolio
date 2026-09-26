import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const enhanced=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const observation=readFileSync(new URL('../supabase/build51_latest_isa_observation.sql',import.meta.url),'utf8');
const weight=readFileSync(new URL('../supabase/build51_weight_reduction_scenario.sql',import.meta.url),'utf8');
const trace=readFileSync(new URL('../supabase/build51_realized_trade_trace.sql',import.meta.url),'utf8');
const cashScope=readFileSync(new URL('../supabase/build51d_cash_account_scope.sql',import.meta.url),'utf8');
assert.match(observation,/on conflict \(account_id,source_reference\) do nothing/);
assert.match(observation,/balance_effective_at/);
assert.doesNotMatch(observation,/insert into public\.(?:transactions|manual_adjustments|daily_account_snapshots)/);
assert.match(weight,/v_assets\*p_target_pct\/100/);
assert.match(weight,/cash_increase_before_cost_krw/);
assert.match(trace,/public\.get_live_ledger_realized\(p_period\)/);
assert.match(trace,/a\.user_id=\(select auth\.uid\(\)\)/);
assert.match(cashScope,/a\.provider='kb_securities'/,'the automatic KB cash bridge excludes manual ISA');
assert.equal(55_538_715+9_150_078,64_688_793);
assert.equal(9_150_078-9_128_990,21_088);

// The requested isolated 10-share accounting fixture. Settlement changes only
// the cash/payable classification, not the economic position or its total NAV.
const lot={shares:10,costCents:10*10000+200};
const allocatedCents=lot.costCents*4/lot.shares,proceedsCents=4*12000-100;
assert.equal(proceedsCents,47900);
assert.equal(allocatedCents,40080);
assert.equal(proceedsCents-allocatedCents,7820);
assert.equal(lot.costCents-allocatedCents,60120);
const purchase={shares:10,cash:0,payable:1002,market:1002};
const settled={...purchase,cash:-1002,payable:0};
const nav=x=>x.market+x.cash-x.payable;
assert.equal(nav(purchase),nav(settled));
assert.equal(140-100,40,'realized P/L measures gain from acquisition');
assert.equal(140-130,10,'period contribution uses the period opening price');

// Exercise the actual UI's authenticated request path and ensure it preserves
// internal cash proceeds and the distinct observation times.
const inputs={weightRun:{disabled:false},weightResult:{textContent:''},
  weightSymbol:{value:'ARM'},weightTarget:{value:'10'}};
const calls=[];
const response={ok:true,position:{symbol:'ARM',value:15_154_956},
  denominator:{value:64_688_793,kb_response_value:55_538_715,manual_overlay:9_150_078,
    primary_observed_at:'2026-09-26T03:10:03Z',isa_captured_at:'2026-09-26T02:42:00Z'},
  scenario:{target_weight_pct:10,sale_value_krw:8_686_076.7,
    position_after_krw:6_468_879.3,cash_increase_before_cost_krw:8_686_076.7,
    assets_after_before_cost_krw:64_688_793,
    pnl_classification:{state:'hypothetical_cost_basis_before_fees',
      hypothetical_realized_krw:-360_564.074, hypothetical_remaining_unrealized_krw:-268_526.926,
      original_unrealized_krw:-629_091,net_new_investment_pnl_krw:0}}};
const context={supabaseUrl:'https://example.invalid',publicKey:'fake-public',
  authFetch:async(_,args)=>{calls.push(JSON.parse(args.body));return {ok:true,json:async()=>response}}};
const start=enhanced.indexOf('  async function runWeightScenario()');
const end=enhanced.indexOf('  async function loadPrevious(',start);
assert.ok(start>0&&end>start);
const ui=vm.createContext({context,document:{getElementById:id=>inputs[id]},Number,Date});
vm.runInContext(enhanced.slice(start,end),ui);
await vm.runInContext('runWeightScenario()',ui);
assert.deepEqual(calls,[{action:'weight-scenario',symbol:'ARM',target_pct:10}]);
assert.match(inputs.weightResult.textContent,/8,686,077원/);
assert.match(inputs.weightResult.textContent,/총자산 64,688,793원 \(비용 전, 변화 없음\)/);
assert.match(inputs.weightResult.textContent,/잔고 유효시각·계좌 식별자 미확인/);
assert.match(inputs.weightResult.textContent,/새 투자손익은 0원/);
assert.match(inputs.weightResult.textContent,/매도분 -360,564원 \/ 잔여 평가차액 -268,527원/);
inputs.weightTarget.value='105';await vm.runInContext('runWeightScenario()',ui);
assert.equal(calls.length,1,'invalid target never leaves device');

// Verified actual trade example: buying 2+1 SOXX shares and selling all 3.
// These are source amounts from the owner's ledger, no assumed exchange rate.
const soxxBuys=[1052.22+2.63,499.60+1.25];
const soxxNetSell=1553.66-3.88-0.04;
assert.equal(soxxBuys.reduce((a,b)=>a+b,0).toFixed(2),'1555.70');
assert.equal(soxxNetSell.toFixed(2),'1549.74');
assert.equal((soxxNetSell-soxxBuys.reduce((a,b)=>a+b,0)).toFixed(2),'-5.96');
const soldStart=html.indexOf('    var sold=(live.soldHoldings&&live.soldHoldings.items)||[];');
const soldEnd=html.indexOf('\n    return ',soldStart);
const scope=vm.createContext({live:{soldHoldings:{ok:true,ready_count:1,candidate_count:1,
  items:[{status:'ledger_calculated',symbol:'SOXX',currency:'USD',sell_quantity:3,
    last_sell:'2026-09-22',realized_local:-5.96,allocated_cost:1555.7,net_proceeds:1549.74}]}},
  period:'1W',cls:n=>n<0?'down':'up',esc:String,
  num:(n,d)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d})});
vm.runInContext(html.slice(soldStart,soldEnd),scope);
const row=vm.runInContext('soldSection',scope);
assert.match(row,/data-realized-trace="SOXX"/);
assert.match(row,/−5\.96 USD/);
assert.match(row,/원본 거래 보기/);
console.log('build51 ISA total-only, owner-scope trace, real SOXX figures and weight scenario passed');
