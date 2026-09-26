import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
for(const [i,source] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(source),`inline script ${i}`);

const source=readFileSync(new URL('../realized-sales-ui.js',import.meta.url),'utf8');
const scope=vm.createContext({window:{}});vm.runInContext(source,scope);
const report={ok:true,period_start:'2026-08-26',period_end:'2026-09-26',candidate_count:2,
  ready_count:1,partial_count:0,order_unverified_count:1,cost_review_count:0,source_review_count:0,
  calculation_version:'realized-sales-v2',items:[
    {transaction_id:'sale-1',symbol:'NVO',name:'종목 A',currency:'USD',quantity:74,
      trade_date:'2026-09-21',date_basis:'broker_order_date_no_intraday_time',status:'calculated',
      realized_local:-382.62,allocated_cost:3343.14,net_proceeds:2960.52,
      reference_krw:-530000,reference_fx_date:'2026-09-26',reference_fx_source:'test',
      historical_krw_estimate:-434871},
    {transaction_id:'sale-2',symbol:'SOXL',name:'긴 이름의 종목',currency:'USD',quantity:12,
      trade_date:'2026-09-22',status:'order_unverified',issue_date:'2026-09-22'}]};
const result=scope.window.realizedSalesUi.section({realizedSales:report,accounts:[{id:'a',provider:'kb_securities',name:'종합위탁'}]},'1M','a');
assert.match(result,/−382\.62 USD/);
assert.match(result,/3,343\.14 USD/);
assert.match(result,/2,960\.52 USD/);
assert.match(result,/거래 순서 확인 필요/);
assert.match(result,/원화 관리손익 추정/);
assert.match(result,/당시 원화 투자손익과 다름/);
assert.match(result,/data-realized-sale="sale-1"/);
assert.doesNotMatch(result,/\bNaN\b/);
const riskStart=html.indexOf('  function riskOverviewCard(home){');
const riskEnd=html.indexOf('  function benchmarkCard(){',riskStart);
const risk=vm.createContext({live:{risk:{ok:true,official_assets_krw:65844164,
  largest_symbol:'ARM',largest_krw:15794237,top_three_krw:34901272,
  foreign_currency_krw:52624397,known_positions_krw:54885397,leveraged_etf_krw:0}},
  weightPct:n=>n.toFixed(2)+'%',money:n=>Math.round(n).toLocaleString('ko-KR')+'원',
  metric:(label,value)=>`${label}: ${value};`,esc:String});
vm.runInContext(html.slice(riskStart,riskEnd),risk);
const riskText=vm.runInContext('riskOverviewCard(false)',risk);
assert.match(riskText,/23\.99%/);
assert.doesNotMatch(riskText,/\+23\.99%/);
assert.match(riskText,/미분류/);
assert.match(riskText,/실질 환노출/);

assert.match(html,/scope\.current_primary_value/);
assert.match(html,/app_display_total|overlay_matches_manual/);
assert.doesNotMatch(html,/통합 총자산 대비/);
console.log('build49 production row logic, source scope and risk signs passed');
