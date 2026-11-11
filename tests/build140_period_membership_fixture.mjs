import fs from 'node:fs';
const s=fs.readFileSync('supabase/build140_period_opening.sql','utf8');
const cte=s.slice(s.indexOf('domestic_period_membership as materialized ('),s.indexOf('), keys as materialized ('))+')';
const tx=[],matches=[],expected=[];
for(const [i,kind] of ['inside','cross_start','cross_end','unequal','foreign','manual','known_outside','future_ledger'].entries()){
 for(let n=0;n<2;n++){
 const id=i*10+n;
 tx.push({id,currency:kind==='foreign'?'USD':'KRW',source:kind==='manual'?'manual':'api',type:'buy',quantity:2,price:100,trade_at:kind==='future_ledger'?'2026-11-01T00:00:00Z':'2026-03-09T03:00:00Z',order_at:kind==='known_outside'?'2025-12-01T00:00:00Z':null,provider_payload:{stnd_is_cd:'KR'+String(i).padStart(10,'0'),dl_amt:'200'}});
 for(let e=0;e<(kind==='unequal'?1:2);e++)matches.push({transaction_id:id,evidence_id:i*10+e,realized_date:kind==='cross_start'&&e===0?'2025-12-31':kind==='cross_end'&&e===1?'2026-11-01':e===0?'2026-03-04':'2026-03-05'});
 expected.push({id,want:kind==='inside'});
 }
}
const rec=(name,data,fields)=>name+" as(select * from jsonb_to_recordset('"+JSON.stringify(data)+"'::jsonb) r("+fields+"))";
console.log('with bounds as(select \'2026-01-01\'::date start_date,\'2026-10-06T00:10:00Z\'::timestamptz cutoff),'+rec('owned_transactions',tx,'id int,currency text,source text,type text,quantity numeric,price numeric,trade_at timestamptz,order_at timestamptz,provider_payload jsonb')+','+rec('domestic_date_candidates',matches,'transaction_id int,evidence_id int,realized_date date')+','+rec('expected',expected,'id int,want boolean')+','+cte.replaceAll('p_period',"'YTD'")+" select count(*) cases,count(*) filter(where e.want is distinct from (p.transaction_id is not null)) failures from expected e left join domestic_period_membership p on p.transaction_id=e.id;");
