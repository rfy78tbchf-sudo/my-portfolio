import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build139_domestic_pending.sql','utf8');
const cte=sql.slice(sql.indexOf('domestic_pending as materialized ('),sql.indexOf('), overseas_pending as materialized ('))+')';
const cases=['valid','raw_qty','raw_cash','fee','tax','date','side','manual','currency','arithmetic','zero_qty','stale','settled','duplicate'];
const rows=[],keys=[],tx=[];
for(let i=0;i<cases.length;i++){
 const name=cases[i],id=String(i+1),sym=String(i+1).padStart(6,'0');keys.push({id,asset_key:sym,currency:'KRW'});
 const row={id,security_id:id,account_id:1,source:'api',currency:'KRW',provider_event_id:'KB:SSQM2442:fixture:'+id,realized_date:'2026-10-06',updated_at:'2026-10-06T00:05:00Z',quantity:2,sell_price:100,sell_amount:200,buy_amount:150,fee:1,tax:2,realized_pnl:47,provider_payload:{trd_dl_ccd:'01',trd_dt:'20261006',shrt_is_cd:'A'+sym,ccls_q:'2',s_amt:'200',fee:'1',svrl_tx:'2'}};
 if(name==='raw_qty')row.provider_payload.ccls_q='3';if(name==='raw_cash')row.provider_payload.s_amt='bad';if(name==='fee')row.provider_payload.fee='3';if(name==='tax')row.provider_payload.svrl_tx='3';if(name==='date')row.provider_payload.trd_dt='20261005';if(name==='side')row.provider_payload.trd_dl_ccd='02';if(name==='manual')row.source='manual';if(name==='currency')row.currency='USD';if(name==='arithmetic')row.realized_pnl=48;if(name==='zero_qty')row.quantity=0;if(name==='stale')row.updated_at='2026-10-05T00:00:00Z';
 rows.push(row);if(name==='duplicate')rows.push({...row,id:'duplicate'});if(name==='settled')tx.push({security_id:id,type:'sell',effective_at:'2026-10-06T00:00:00Z',trade_at:'2026-10-08T03:00:00Z'});
}
const rec=(name,rows,fields)=>name+" as (select * from jsonb_to_recordset('"+JSON.stringify(rows)+"'::jsonb) r("+fields+"))";
console.log('with account as(select 1 id),bounds as(select \'2026-10-06T00:10:00Z\'::timestamptz cutoff),'+rec('events',rows,'id text,security_id text,account_id int,source text,currency text,provider_event_id text,realized_date date,updated_at timestamptz,quantity numeric,sell_price numeric,sell_amount numeric,buy_amount numeric,fee numeric,tax numeric,realized_pnl numeric,provider_payload jsonb')+','+rec('keys',keys,'id text,asset_key text,currency text')+','+rec('dated_transactions',tx,'security_id text,type text,effective_at timestamptz,trade_at timestamptz')+','+cte.replaceAll('public.realized_pnl_events','events')+" select count(*) cases,count(*) filter(where (p.security_id is not null)<>(k.id='1') or p.cash<>197) failures from keys k left join domestic_pending p on p.security_id=k.id;");
