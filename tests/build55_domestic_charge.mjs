import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const code=readFileSync(process.env.WORKER_SOURCE||new URL('../supabase/functions/kb-sync-worker/index.ts',import.meta.url),'utf8');
const start=code.indexOf('function normalizeLedger('),end=code.indexOf('async function settlementEvidence(',start);
assert.ok(start>0&&end>start);
const n=v=>Number(String(v??'').replaceAll(',','').trim())||0;
const sandbox=vm.createContext({n,nOrNull:n,normalizeKrSymbol:()=> '000660',
  classifyLedger:r=>r.kind,isoKstDate:()=> '2026-09-22T00:00:00+09:00',
  currency:()=> 'KRW',marketCountry:()=> 'KR',signedAmount:(v,t)=>t==='buy'?-Math.abs(v):Math.abs(v)});
vm.runInContext(stripTypeScriptTypes(code.slice(start,end)),sandbox);
const base={dl_dt:'20260922',stnd_is_cd:'KR000660',dl_amt:'3,686,000',
  ec_amt:'3663605',fcrncy_amt:'0',fee:'410',abrd_fee:'0',
  tx:'22395',dl_tx:'5496',q:'2',dl_sq:'1',smry_nm:'주식장내매도'};
const sold=sandbox.normalizeLedger([{...base,kind:'sell'}]).transactions[0];
assert.equal(sold.fee,410);
assert.equal(sold.tax,21985,'domestic total charge contains the fee');
assert.equal(sold.net_amount,3663605);
assert.equal(sold.provider_payload.tx,'22395','raw broker data remains intact');
const bought=sandbox.normalizeLedger([{...base,kind:'buy',dl_sq:'2',dl_amt:'10000',
  ec_amt:'10010',fee:'10',tx:'10',dl_tx:''}]).transactions[0];
assert.equal(bought.tax,0);
assert.equal(bought.net_amount,-10010);
const unexplained=sandbox.normalizeLedger([{...base,kind:'sell',dl_sq:'3',ec_amt:'3663500'}]).transactions[0];
assert.equal(unexplained.tax,22395,'non-reconciling cash is not silently reclassified');
const netSale=sandbox.normalizeLedger([{...base,kind:'sell',dl_sq:'4',dl_amt:'1000',
  ec_amt:'997',fee:'2',tx:'3',dl_tx:'1'}]).transactions[0];
assert.equal(netSale.gross_amount,1000);
assert.equal(netSale.fee,2);
assert.equal(netSale.tax,1);
assert.equal(netSale.net_amount,997,'cash is already net of all three units of charges');
assert.equal(netSale.net_amount-800,197,'moving-average cost uses net sale cash, not 994');
// Synthetic cash identity: 1000 - total charge 3 - arrears 7 - loan 20 = 970.
// The total charge includes fee 2 and tax 1; neither repayment is tax.
const repayment={...base,kind:'sell',dl_sq:'5',dl_amt:'1000',ec_amt:'970',
  fee:'2',tx:'3',dl_tx:'1',arrs_fee:'7',etc_lndng_amt_rpay_amt:'20'};
const withRepayment=sandbox.normalizeLedger([repayment]).transactions[0];
assert.equal(withRepayment.tax,1,'explicit additional deductions must not duplicate fee as tax');
assert.equal(withRepayment.fee,2);
assert.equal(withRepayment.gross_amount,1000);
assert.equal(withRepayment.net_amount,970,'do not add repayments back into stored cash');
assert.equal(withRepayment.provider_payload.arrs_fee,'7');
assert.equal(withRepayment.provider_payload.etc_lndng_amt_rpay_amt,'20');
const feeOnly=sandbox.normalizeLedger([{...repayment,tx:'2',dl_tx:'',ec_amt:'991',etc_lndng_amt_rpay_amt:'0'}]).transactions[0];
assert.equal(feeOnly.tax,0);
assert.equal(feeOnly.fee,2);
assert.equal(feeOnly.net_amount,991);
for(const patch of [{arrs_fee:undefined},{arrs_fee:''},{arrs_fee:'bad'},
  {etc_lndng_amt_rpay_amt:null},{etc_lndng_amt_rpay_amt:'bad'},
  {arrs_fee:'-7',ec_amt:'984'},{ec_amt:'969'},{ec_amt:'970.01'},
  {ec_amt:'0',arrs_fee:'977'},{fcrncy_amt:'5'},
  {fee:'bad'},{tx:'1',ec_amt:'972'},{dl_amt:'9007199254740992'}]){
  const rejected=sandbox.normalizeLedger([{...repayment,...patch}]).transactions[0];
  assert.equal(rejected.tax,Number(patch.tx??3),'incomplete, invalid or inexact evidence must not authorize a split');
}
const buyRepayment=sandbox.normalizeLedger([{...repayment,kind:'buy',ec_amt:'1030'}]).transactions[0];
assert.equal(buyRepayment.tax,3,'sale-only evidence must not change purchase rules');
console.log('Broker total charge split and raw preservation passed');
