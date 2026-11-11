import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build123_local_held_split_history.sql','utf8');
const ctes=sql.slice(sql.indexOf('split_records as materialized ('),sql.indexOf('), verified_plain_local_history as materialized ('))+')';
const cases=['valid','missing_pair','duplicate','wrong_source','nonzero_cash','wrong_raw_qty','wrong_raw_cash','reverse','pending','bad_amount','invalid_cash','wrong_balance','other_event','future_trade','early_sale','wrong_outgoing'];
const rows=[],calc=[],closed=[];
for(const key of cases){
 const base={asset_key:key,security_id:key,source:'api',currency:'USD',net_amount:0,provider_payload:{},day:'2025-01-01',trade_at:'2025-01-01T03:00:00Z'};
 const add=(suffix,type,quantity,date)=>rows.push({...base,id:key+suffix,type,quantity,day:date,trade_at:date+'T03:00:00Z',provider_payload:{q:String(quantity),ec_amt:'0000',smry_nm:type==='split_in'?'액면분할 입고':'액면분할 출고'}});
 add('buy','buy',1,'2025-01-01');add('out','split_out',1,'2025-01-02');add('in','split_in',10,'2025-01-02');add('sell','sell',10,'2025-01-03');
 const get=x=>rows.find(r=>r.id===key+x);
 if(key==='missing_pair')rows.splice(rows.indexOf(get('out')),1);
 if(key==='duplicate')rows.push({...get('in'),id:key+'duplicate'});
 if(key==='wrong_source')get('in').source='manual';
 if(key==='nonzero_cash')get('in').net_amount=1;
 if(key==='wrong_raw_qty')get('in').provider_payload.q='11';
 if(key==='wrong_raw_cash')get('in').provider_payload.ec_amt='0010';
 if(key==='reverse')get('in').provider_payload.smry_nm='액면병합 입고';
 if(key==='other_event')add('other','transfer_in',1,'2025-01-02');
 if(key==='future_trade')add('future','buy',1,'2027-01-01');
 if(key==='early_sale'){get('sell').day='2024-12-31';get('sell').trade_at='2024-12-31T03:00:00Z';}
 if(key==='wrong_outgoing'){get('buy').quantity=2;get('sell').quantity=11;}
 calc.push({asset_key:key,currency:'USD',issue:'거래일 확인 필요',end_qty:0,pending_count:key==='pending'?1:0,bad_amounts:key==='bad_amount'?1:0,snapshot_quantity_mismatch:false,start_qty:key==='wrong_balance'?8:9,trade_count:2,trade_cash:20,dividend:2});
 closed.push({asset_key:key,valid:key!=='invalid_cash',sales:1,trades:2,cash:20});
}
const j=x=>"'"+JSON.stringify(x)+"'::jsonb";
console.log(`with bounds as(select '2026-10-04'::timestamptz cutoff),keys as(select x id,x asset_key from unnest(array[${cases.map(x=>"'"+x+"'").join(',')}]) x),dated_transactions as(select * from jsonb_to_recordset(${j(rows)}) x(id text,security_id text,source text,currency text,net_amount numeric,provider_payload jsonb,day date,trade_at timestamptz,type text,quantity numeric)),period_trades as(select t.*,k.asset_key from dated_transactions t join keys k on k.id=t.security_id where type in ('buy','sell') and trade_at<'2026-10-04'),calculated as(select * from jsonb_to_recordset(${j(calc)}) x(asset_key text,currency text,issue text,end_qty numeric,pending_count int,bad_amounts int,snapshot_quantity_mismatch boolean,start_qty numeric,trade_count int,trade_cash numeric,dividend numeric)),closed_sources as(select * from jsonb_to_recordset(${j(closed)}) x(asset_key text,valid boolean,sales int,trades int,cash numeric)),${ctes.replaceAll('p_period',"'ALL'")} select count(*) cases,count(*) filter(where (v.asset_key is not null)<>(k.id='valid') or v.pnl_local<>22) failures from keys k left join verified_split_history v on v.asset_key=k.id;`);
