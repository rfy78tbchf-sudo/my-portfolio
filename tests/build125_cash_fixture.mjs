import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build125_complete_history.sql','utf8');
const ctes=sql.slice(sql.indexOf('domestic_raw as materialized ('),sql.indexOf('), pending_checks as materialized ('))+')';
const cases=['normal','combined','negative_cash','loan','bad_sum','bad_quantity','bad_raw','missing_field','manual','negative_fee','missing_trade','corporate','pending','bad_ledger','negative_running','open_balance','stale_held','nonzero_start','non_all'];
const ts=[],cs=[],qs=[];
for(const key of cases){
 const raw=(gross,cash,fee,tx)=>({dl_amt:String(gross),ec_amt:String(cash),fee:String(fee),tx:String(tx),arrs_fee:'0',etc_lndng_amt_rpay_amt:'0',incm_tx:'0',dl_tx:String(tx-fee),rsdnt_tx:'0',ffs_tx:'0',trsf_tx:'0'});
 const buy={security_id:key,type:'buy',currency:'KRW',source:'api',quantity:1,price:100,net_amount:-101,fee:1,tax:0,provider_payload:raw(100,101,1,1)};
 const sell={security_id:key,type:'sell',currency:'KRW',source:'api',quantity:1,price:200,net_amount:197,fee:1,tax:2,provider_payload:raw(200,197,1,3)};
 if(['combined','loan'].includes(key)){sell.net_amount=193;sell.tax=3;sell.provider_payload.arrs_fee='4';sell.provider_payload.ec_amt='193';}
 if(key==='loan'){sell.net_amount=163;sell.provider_payload.ec_amt='163';sell.provider_payload.etc_lndng_amt_rpay_amt='30';}
 if(key==='negative_cash'){sell.net_amount=50;sell.tax=250;sell.provider_payload=raw(200,-50,1,250);}
 if(key==='bad_sum')sell.provider_payload.ec_amt='196';
 if(key==='bad_quantity')sell.quantity=2;
 if(key==='bad_raw')sell.provider_payload.arrs_fee='bad';
 if(key==='missing_field')delete sell.provider_payload.ec_amt;
 if(key==='manual')sell.source='manual';
 if(key==='negative_fee')sell.fee=-1;
 ts.push(buy,sell);
 cs.push({asset_key:key,security_id:key,currency:'KRW',issue:'거래 금액 확인 필요',start_qty:key==='nonzero_start'?1:0,end_qty:key==='stale_held'?1:0,pending_count:key==='pending'?1:0,corporate_event:key==='corporate',snapshot_quantity_mismatch:false,end_value:key==='stale_held'?100:0,as_of:'2025-01-01T00:00:00Z',cutoff:'2025-01-02T00:00:00Z',dividend:0,trade_count:key==='missing_trade'?3:2});
 qs.push({asset_key:key,source_valid:key!=='bad_ledger',min_qty:key==='negative_running'?-1:0,final_qty:key==='open_balance'||key==='stale_held'?1:0});
}
const j=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const prefix=`with keys as(select x id,x asset_key from unnest(array[${cases.map(x=>"'"+x+"'").join(',')}]) x),dated_transactions as(select * from jsonb_to_recordset(${j(ts)}) x(security_id text,type text,currency text,source text,quantity numeric,price numeric,net_amount numeric,fee numeric,tax numeric,provider_payload jsonb)),calculated as(select * from jsonb_to_recordset(${j(cs)}) x(asset_key text,security_id text,currency text,issue text,start_qty numeric,end_qty numeric,pending_count int,corporate_event boolean,snapshot_quantity_mismatch boolean,end_value numeric,as_of timestamptz,cutoff timestamptz,dividend numeric,trade_count int)),ledger_quantity_evidence as(select * from jsonb_to_recordset(${j(qs)}) x(asset_key text,source_valid boolean,min_qty numeric,final_qty numeric)),`;
const expected={normal:96,combined:92,negative_cash:-151,loan:92,non_all:96};
console.log(prefix+ctes.replaceAll('p_period',"'ALL'")+` select count(*) cases,count(*) filter(where (r.asset_key is not null)<>(e.v is not null) or r.pnl<>e.v) failures from keys k left join domestic_resolved r on r.asset_key=k.id left join jsonb_each_text(${j(expected)}) ev on ev.key=k.id left join lateral(select ev.value::numeric v) e on true;`);
