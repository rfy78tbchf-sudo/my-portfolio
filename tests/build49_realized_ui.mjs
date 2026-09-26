import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
for(const [i,source] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(source),`inline script ${i}`);

const soldStart=html.indexOf('    var sold=(live.soldHoldings&&live.soldHoldings.items)||[];');
const soldEnd=html.indexOf('\n    return ',soldStart);
assert.ok(soldStart>0&&soldEnd>soldStart,'production sold rows are found');
const makeContext=(items)=>vm.createContext({live:{soldHoldings:{ok:true,items,ready_count:1,candidate_count:2}},period:'1W',
  cls:n=>n<0?'down':'up',esc:s=>String(s).replace(/</g,'&lt;'),
  num:(n,d)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d})});
const nvo={symbol:'NVO',name:'노보노디스크(ADR)',market:'NASDAQ',currency:'USD',sell_quantity:74,
  last_sell:'2026-09-23',position_state:'fully_closed',status:'ledger_calculated',
  realized_local:-382.62,allocated_cost:3343.14,net_proceeds:2960.52};
const blocked={symbol:'SOXL',name:'긴 반도체 관련 상품',sell_quantity:12,last_sell:'2026-09-22',
  status:'missing_evidence',position_state:'unverified',missing_code:'same_day_execution_order_unverified',
  missing_date:'2026-09-22'};
const cx=makeContext([nvo,blocked]);vm.runInContext(html.slice(soldStart,soldEnd),cx);
const result=vm.runInContext('soldSection',cx);
assert.match(result,/−382\.62 USD/);
assert.match(result,/3,343\.14 USD/);
assert.match(result,/2,960\.52 USD/);
assert.match(result,/당일 매수·매도 체결순서 확인 필요/);
assert.doesNotMatch(result,/KB 해외손익 조회값 없음/);
assert.doesNotMatch(result,/\bNaN\b/);
assert.match(result,/거래통화 기준이며 계좌 원화 기간성과에 합산하지 않습니다/);

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
