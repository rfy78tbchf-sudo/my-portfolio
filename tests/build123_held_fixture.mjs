import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build123_local_held_split_history.sql','utf8');
const closed=sql.slice(sql.indexOf('closed_sources as ('),sql.indexOf('), closed_cycles as ('))+')';
const verified=sql.slice(sql.indexOf('verified_plain_local_history as materialized ('),sql.indexOf('), verified_local_history as materialized ('))+')';
const rows=[],trades=[];
const cases=[['ready',{}],['bounded',{test_period:'1M'}],['domestic',{currency:'KRW'}],['opening',{start_qty:1}],['held',{end_qty:1,end_value:50}],['stale',{end_qty:1,end_value:50,as_of:'2025-01-01'}],['missing_value',{end_qty:1,end_value:null}],['pending',{pending_count:1}],['negative',{min_qty:-1}],['corporate',{corporate_event:true}],['bad_amount',{bad_amounts:1}],['snapshot',{snapshot_quantity_mismatch:true}],['other_issue',{issue:'분할·이관 확인 필요'}],['bad_fee',{}],['missing_fee',{}],['bad_sign',{}],['future_trade',{}],['source',{}],['zero_qty',{}]];
for(const [key,override] of cases){
 rows.push({asset_key:key,test_period:'ALL',end_value:0,as_of:'2026-10-03T00:00:00Z',cutoff:'2026-10-03T00:00:00Z',currency:'USD',issue:'거래일 확인 필요',start_qty:0,end_qty:0,pending_count:0,min_qty:0,corporate_event:false,bad_amounts:0,snapshot_quantity_mismatch:false,trade_count:2,trade_cash:18,dividend:2,...override});
 for(const type of ['buy','sell'])trades.push({security_id:key,account_id:'fixture',type,quantity:1,fee:key==='missing_fee'?null:1,tax:0,source:key==='source'?'manual':'api',net_amount:type==='buy'?(key==='bad_sign'?101:-101):119,provider_payload:{dl_amt:type==='buy'?'100':key==='bad_fee'?'150':'120'},trade_at:'2026-01-05T03:00:00Z',effective_at:null});
 if(key==='zero_qty')trades.at(-1).quantity=0;
 if(key==='future_trade')trades.push({...trades.at(-1),trade_at:'2027-01-01T03:00:00Z'});
}
const json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
console.log(`with account as (select 'fixture'::text id), bounds as(select '2020-01-01'::date start_date,'2026-10-03T00:00:00Z'::timestamptz cutoff),
calculated as(select * from jsonb_to_recordset(${json(rows)}) as x(asset_key text,test_period text,currency text,issue text,start_qty numeric,end_qty numeric,pending_count int,min_qty numeric,corporate_event boolean,bad_amounts int,snapshot_quantity_mismatch boolean,trade_count int,trade_cash numeric,dividend numeric,end_value numeric,as_of timestamptz,cutoff timestamptz)),
keys as(select asset_key id,asset_key from calculated),
dated_transactions as(select * from jsonb_to_recordset(${json(trades)}) as x(security_id text,account_id text,type text,quantity numeric,fee numeric,tax numeric,source text,net_amount numeric,provider_payload jsonb,trade_at timestamptz,effective_at timestamptz)),
${closed},${verified.replaceAll('p_period','c.test_period')}
select count(*) cases, count(*) filter(where (v.asset_key is not null)<>(c.asset_key in ('ready','held')) or v.pnl_local<>case when c.asset_key='held' then 70 else 20 end) failures from calculated c left join verified_plain_local_history v using(asset_key);`);
