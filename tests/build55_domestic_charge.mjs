import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const code=readFileSync(new URL('../supabase/functions/kb-sync-worker/index.ts',import.meta.url),'utf8');
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
console.log('Broker total charge split and raw preservation passed');
