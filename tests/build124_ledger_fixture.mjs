import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build124_ledger_chronology.sql','utf8');
const ctes=sql.slice(sql.indexOf('ledger_quantity_days as materialized ('),sql.indexOf('), verified_local_history as materialized ('))+')';
const cases=['valid','negative_running','open_quantity','bad_raw_date','missing_date','manual','future_trade','pending','corporate','bad_amount','invalid_cash','snapshot','nonzero_start','held','wrong_reason','foreign_krw'];
const trades=[],calculated=[],sources=[];
for(const key of cases){
 for(const type of ['buy','sell']){const date=type==='buy'?'2025-01-02':'2025-01-03';trades.push({security_id:key,type,quantity:key==='open_quantity'&&type==='buy'?2:1,source:key==='manual'?'manual':'api',trade_at:date+'T03:00:00Z',provider_payload:{dl_dt:key==='bad_raw_date'?'20250101':key==='missing_date'?null:date.replaceAll('-','')}});}
 if(key==='negative_running'){trades.at(-1).trade_at='2025-01-01T03:00:00Z';trades.at(-1).provider_payload.dl_dt='20250101';}
 if(key==='future_trade'){trades.at(-1).trade_at='2027-01-03T03:00:00Z';trades.at(-1).provider_payload.dl_dt='20270103';}
 calculated.push({asset_key:key,currency:key==='foreign_krw'?'KRW':'USD',issue:key==='wrong_reason'?'거래 금액 확인 필요':'수량 연결 확인 필요',start_qty:key==='nonzero_start'?1:0,end_qty:key==='held'?1:0,pending_count:key==='pending'?1:0,corporate_event:key==='corporate',bad_amounts:key==='bad_amount'?1:0,snapshot_quantity_mismatch:key==='snapshot',trade_count:2,trade_cash:20,dividend:2});
 sources.push({asset_key:key,valid:key!=='invalid_cash',sales:1,trades:2,cash:20});
}
const j=x=>"'"+JSON.stringify(x)+"'::jsonb";
console.log(`with bounds as(select '2026-10-04'::timestamptz cutoff),keys as(select x id,x asset_key from unnest(array[${cases.map(x=>"'"+x+"'").join(',')}]) x),dated_transactions as(select * from jsonb_to_recordset(${j(trades)}) x(security_id text,type text,quantity numeric,source text,trade_at timestamptz,provider_payload jsonb)),calculated as(select * from jsonb_to_recordset(${j(calculated)}) x(asset_key text,currency text,issue text,start_qty numeric,end_qty numeric,pending_count int,corporate_event boolean,bad_amounts int,snapshot_quantity_mismatch boolean,trade_count int,trade_cash numeric,dividend numeric)),closed_sources as(select * from jsonb_to_recordset(${j(sources)}) x(asset_key text,valid boolean,sales int,trades int,cash numeric)),${ctes.replaceAll('p_period',"'ALL'")} select count(*) cases,count(*) filter(where (v.asset_key is not null)<>(k.id='valid') or v.pnl_local<>22) failures from keys k left join verified_ledger_local_history v on v.asset_key=k.id;`);
