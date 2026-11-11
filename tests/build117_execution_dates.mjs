// Emits a read-only PostgreSQL regression using the actual production matcher.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql=fs.readFileSync(process.argv[2]||'supabase/build117_domestic_execution_dates.sql','utf8');
const matcher=sql.slice(sql.indexOf('), domestic_date_candidates'),sql.indexOf('), bounds as (')).replaceAll('public.realized_pnl_events','fixture_evidence');
assert.ok(matcher.includes('c.transaction_matches=1 and c.evidence_matches=1'));
const tx=[],ev=[],expected=[];
function add(id,changes={},eChanges={},want=true){
 const isin='KR'+String(id).padStart(10,'0');
 const t={id,account_id:1,type:'buy',currency:'KRW',quantity:2,price:100,source:'api',trade_at:'2026-10-01T03:00:00Z',order_at:null,provider_payload:{stnd_is_cd:isin,dl_amt:'200',dl_dt:'20261001'},...changes};
 const r={id,account_id:1,source:'api',currency:'KRW',quantity:2,sell_price:100,buy_amount:200,sell_amount:0,realized_date:'2026-09-29',provider_event_id:'KB:SSQM2442:fixture:'+id,provider_payload:{stnd_is_cd:isin,trd_dl_ccd:'02',trd_dt:'20260929'},...eChanges};
 tx.push(t);ev.push(r);expected.push({id,recovered:want?'2026-09-29':null});return {t,r};
}
add(1); // Settlement in October, execution in September.
add(2,{type:'sell'},{buy_amount:100,sell_amount:200,provider_payload:{stnd_is_cd:'KR0000000002',trd_dl_ccd:'01',trd_dt:'20260929'}});
const duplicateEvidence=add(3,{}, {},false);ev.push({...duplicateEvidence.r,id:103});
const duplicateLedger=add(4,{}, {},false);tx.push({...duplicateLedger.t,id:104});expected.push({id:104,recovered:null});
add(5,{}, {account_id:2},false);
add(6,{}, {quantity:3},false);
add(7,{}, {sell_price:101},false);
add(8,{}, {buy_amount:201},false);
add(9,{currency:'USD'}, {},false);
add(10,{provider_payload:{stnd_is_cd:'KR0000000010',dl_amt:'bad',dl_dt:'20261001'}},{},false);
add(11,{}, {provider_payload:{stnd_is_cd:'KR0000000011',trd_dl_ccd:'01',trd_dt:'20260929'}},false);
add(12,{}, {realized_date:'2026-09-01',provider_payload:{stnd_is_cd:'KR0000000012',trd_dl_ccd:'02',trd_dt:'20260901'}},false);
add(13,{order_at:'2026-09-28T01:23:00Z'},{},false);
add(14,{}, {provider_payload:{stnd_is_cd:'KR0000000014',trd_dl_ccd:'02',trd_dt:'20260928'}},false);
add(15,{source:'manual'}, {},false);
const quoted=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
process.stdout.write(`with owned_transactions as (select * from jsonb_to_recordset(${quoted(tx)}) as t(id int,account_id int,type text,currency text,quantity numeric,price numeric,source text,trade_at timestamptz,order_at timestamptz,provider_payload jsonb)), fixture_evidence as (select * from jsonb_to_recordset(${quoted(ev)}) as r(id int,account_id int,source text,currency text,quantity numeric,sell_price numeric,buy_amount numeric,sell_amount numeric,realized_date date,provider_event_id text,provider_payload jsonb)`+matcher+`), expected as (select * from jsonb_to_recordset(${quoted(expected)}) as e(id int,recovered date)) select count(*) tests,bool_and(d.recovered_date is not distinct from e.recovered) all_passed,bool_and(case when d.id=13 then d.effective_at='2026-09-28T01:23:00Z'::timestamptz else true end) existing_order_preserved,bool_and(case when d.id=1 then (d.effective_at at time zone 'Asia/Seoul')::date='2026-09-29' else true end) month_boundary_correct from expected e join dated_transactions d using(id);`);
