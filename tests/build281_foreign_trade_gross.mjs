import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const src=fs.readFileSync(process.env.WORKER_SOURCE||'supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const ctx=vm.createContext({Date,Intl});
vm.runInContext(stripTypeScriptTypes(section('function n(','async function fetchCurrent(')+section('function ymd(','async function loadSecurityMaster(')+section('function marketCountry(','function normalizeMasterRows(')+section('function normalizeLedger(','async function settlementEvidence(')),ctx);
const base={dl_dt:'20300110',dl_sq:'1',stnd_is_cd:'US0000000001',crncy_clsf_nm:'USD',smry_nm:'매수',dl_amt:'1,000.00',fcrncy_amt:'1002.50',ec_amt:'0',fee:'0',abrd_fee:'2.50',tx:'0',q:'10',dl_uprc:'100',exch_r:'0'};
const normalize=r=>ctx.normalizeLedger([r]);
const buy=normalize(base).transactions[0];
if(process.argv.includes('--baseline')){
 assert.equal(buy.gross_amount,-1002.5);assert.equal(buy.net_amount,-1002.5);
 console.log('REPRODUCED: settled cash incorrectly stored as gross consideration');process.exit(0);
}
assert.equal(buy.gross_amount,-1000);assert.equal(buy.net_amount,-1002.5);assert.equal(buy.fee,2.5);
assert.equal(buy.provider_payload,base,'raw source remains unchanged');
const sell=normalize({...base,dl_sq:'2',smry_nm:'매도',dl_amt:'1200',fcrncy_amt:'1196',abrd_fee:'3',tx:'1'}).transactions[0];
assert.equal(sell.gross_amount,1200);assert.equal(sell.net_amount,1196);assert.equal(sell.fee,3);assert.equal(sell.tax,1);
// Independent fixed expectation: +200 price gain -2.50 buy fee -3 sell fee -1 tax =193.50.
assert.equal(sell.net_amount+buy.net_amount,193.5);
assert.equal(sell.gross_amount+buy.gross_amount-buy.fee-sell.fee-sell.tax,193.5);
const zero=normalize({...base,dl_amt:'0',fcrncy_amt:'0',abrd_fee:'0'}).transactions[0];
assert.equal(Math.abs(zero.gross_amount),0);
for(const bad of [undefined,null,'',' ','broken','NaN','Infinity','100oops'])
 assert.throws(()=>normalize({...base,dl_amt:bad}),/LEDGER_TRADE_GROSS_MISSING/);
// FX is an internal currency exchange; its blank security gross is not a missing trade.
const fx=normalize({...base,stnd_is_cd:'',smry_nm:'외화매수 출금',dl_amt:'',fcrncy_amt:'100',ec_amt:'130000',abrd_fee:'0'});
assert.equal(fx.transactions[0].type,'fx');assert.equal(fx.transactions[0].currency,'KRW');
assert.equal(fx.transactions[0].net_amount,-130000);assert.equal(fx.cashFlows.length,0);
// Resync retains provider identity and does not mutate the source or create a fee row.
const again=normalize(base);assert.equal(again.transactions.length,1);assert.equal(again.transactions[0].external_id,buy.external_id);
assert.equal(again.transactions[0].gross_amount,-1000);assert.equal(again.transactions[0].net_amount,-1002.5);
console.log('PASS: independent trade gross and settled cash; fixed 193.50 round trip; missing gross rejected; FX/internal flow and resync identity preserved');
