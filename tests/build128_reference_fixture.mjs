import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build128_reference_fx.sql','utf8');
const ctes=sql.slice(sql.indexOf('reference_rates as materialized ('),sql.indexOf('), reference_items as materialized ('))+')';
const cases=['closed','held','cash_gap','duplicate_event','missing_fx','future_fx','stale_fx','missing_end_fx','bad_end_fx','tax','zero'];
const items=[],members=[],cash=[],fx=[];
for(const key of cases){
 let end=0,pnl=20,endFx=null;
 if(key==='held'||key==='missing_end_fx'||key==='bad_end_fx'){end=50;pnl=-50;endFx=key==='missing_end_fx'?null:key==='bad_end_fx'?0:1200;}
 if(key==='cash_gap')pnl=19;
 if(key==='tax')pnl=10;
 if(key==='zero')pnl=0;
 items.push({item:{security_id:key,currency:'USD',end_value_local:end,end_fx:endFx,pnl_local:pnl}});
 members.push({row_id:key,asset_key:key});
 cash.push({asset_key:key,currency:key,cash:-100,day:'2025-01-01',ledger_date_basis:true});
 if(!end)cash.push({asset_key:key,currency:key,cash:key==='zero'?100:120,day:'2025-01-02',ledger_date_basis:true});
 if(key==='duplicate_event')cash.push({...cash.at(-1)});
 if(key==='tax')cash.push({asset_key:key,currency:key,cash:-10,day:'2025-01-02',ledger_date_basis:false});
 if(key!=='missing_fx')for(const [day,rate] of [['2025-01-01',1000],['2025-01-02',1100]])fx.push({base_currency:key,quote_currency:'KRW',rate_date:key==='future_fx'?'2025-01-03':key==='stale_fx'?'2024-12-20':day,rate,source:'fixture',observed_at:'2025-06-01'});
}
const rec=(n,v,f)=>`${n} as(select * from jsonb_to_recordset('${JSON.stringify(v)}'::jsonb) x(${f}))`;
const input=[rec('taxed_items',items,'item jsonb'),rec('reference_members',members,'row_id text,asset_key text'),rec('reference_cash',cash,'asset_key text,currency text,cash numeric,day date,ledger_date_basis boolean'),rec('fixture_fx',fx,'base_currency text,quote_currency text,rate_date date,rate numeric,source text,observed_at timestamptz')];
console.log('with '+input.join(',')+','+ctes.replaceAll('p_period',"'ALL'").replaceAll('public.fx_rates','fixture_fx')+" select count(*) cases,count(*) filter(where (c.row_id is not null)<>(t.item->>'security_id' in ('closed','held','tax','zero')) or c.amount<>case t.item->>'security_id' when 'closed' then 32000 when 'held' then -40000 when 'tax' then 21000 when 'zero' then 10000 end) failures from taxed_items t left join reference_conversions c on c.row_id=t.item->>'security_id';");
