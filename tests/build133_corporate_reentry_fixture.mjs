import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build133_corporate_reentry.sql','utf8');
const ctes=sql.slice(sql.indexOf('corporate_members as ('),sql.indexOf('), resolved_items as materialized ('))+')';
const cases=['valid','missing_leg','wrong_ratio','bad_raw_qty','bad_source','nonzero_transfer_cash','transfer_fee','future','negative_running','unknown_event','bad_fraction_cash','wrong_dividend','invalid_trade_cash','missing_trade','reentry','stale_pending','wrong_pending_count','wrong_ending','stale_ending','oversell'];
const cat=[],ks=[],ts=[],cs=[],zs=[],ps=[],pcs=[];
for(const key of cases){
 const old=key+'_old',now=key+'_new';
 cat.push({group_key:key,old_key:old,new_key:now,ratio:.2,event_date:'2025-01-03',out_kind:'액면병합 출고',in_kind:'액면병합 입고'});
 ks.push({id:old,asset_key:old},{id:now,asset_key:now});
 const t=(id,security_id,type,quantity,price,cash,date,kind)=>({id,security_id,type,quantity,price,net_amount:cash,fee:0,tax:0,currency:'USD',source:'api',trade_at:date+'T03:00:00Z',provider_payload:{dl_dt:date.replaceAll('-',''),q:String(quantity||0),ec_amt:'000000',fcrncy_amt:String(Math.abs(cash)),smry_nm:kind}});
 const rows=[t(key+'buy',old,'buy',11,10,-110,'2025-01-02','외화매수'),t(key+'out',old,'split_out',11,null,0,'2025-01-03','액면병합 출고'),t(key+'in',now,'split_in',2,null,0,'2025-01-03','액면병합 입고'),t(key+'sell',now,'sell',2,30,60,'2025-01-04','외화매도'),t(key+'fraction',old,'other',null,null,2,'2025-01-05','단수주매각대금 입금')];
 if(key==='missing_leg')rows.splice(2,1);
 if(key==='wrong_ratio')cat.at(-1).ratio=.5;
 if(key==='bad_raw_qty')rows[2].provider_payload.q='3';
 if(key==='bad_source')rows[2].source='manual';
 if(key==='nonzero_transfer_cash')rows[2].net_amount=1;
 if(key==='transfer_fee')rows[2].fee=1;
 if(key==='future'){rows[4].trade_at='2027-01-05T03:00:00Z';rows[4].provider_payload.dl_dt='20270105';}
 if(key==='negative_running'){rows[0].trade_at='2025-01-04T03:00:00Z';rows[0].provider_payload.dl_dt='20250104';}
 if(key==='unknown_event')rows.push(t(key+'unknown',old,'transfer_out',1,null,0,'2025-01-05','미확인 출고'));
 if(key==='bad_fraction_cash')rows[4].provider_payload.fcrncy_amt='3';
 ts.push(...rows);
 for(const asset of [old,now]){
 const reopened=['reentry','stale_pending','wrong_pending_count','wrong_ending','stale_ending','oversell'].includes(key)&&asset===now;
 const cash=asset===old?-110:60;
 if(reopened){ps.push({asset_key:asset,type:key==='oversell'?'sell':'buy',quantity:1,day:'2026-10-04'});pcs.push({asset_key:asset,valid:key!=='stale_pending',n:key==='wrong_pending_count'?2:1,cash:-20});}

 cs.push({asset_key:asset,security_id:asset,currency:'USD',end_qty:reopened?(key==='wrong_ending'?2:1):0,end_value:reopened?25:0,as_of:key==='stale_ending'?'2026-10-03T09:10:00Z':'2026-10-04T09:10:00Z',cutoff:'2026-10-04T09:10:00Z',pending_count:reopened?1:0,bad_amounts:0,trade_count:key==='missing_trade'||reopened?2:1,trade_cash:cash-(reopened?20:0),dividend:key==='wrong_dividend'?1:0,provisional_count:1});
 zs.push({asset_key:asset,valid:key!=='invalid_trade_cash',trades:1,cash});
 }
}
const j=x=>"'"+JSON.stringify(x)+"'::jsonb";
const rec=(name,data,fields)=>`${name} as(select * from jsonb_to_recordset(${j(data)}) x(${fields}))`;
const input=[rec('pending',ps,'asset_key text,type text,quantity numeric,day date'),rec('pending_checks',pcs,'asset_key text,valid boolean,n int,cash numeric'),"bounds as(select '2026-10-04T09:10:00Z'::timestamptz cutoff)",rec('corporate_catalog',cat,'group_key text,old_key text,new_key text,ratio numeric,event_date date,out_kind text,in_kind text'),rec('keys',ks,'id text,asset_key text'),rec('dated_transactions',ts,'id text,security_id text,type text,quantity numeric,price numeric,net_amount numeric,fee numeric,tax numeric,currency text,source text,trade_at timestamptz,provider_payload jsonb'),rec('calculated',cs,'asset_key text,security_id text,currency text,end_qty numeric,end_value numeric,as_of timestamptz,cutoff timestamptz,pending_count int,bad_amounts int,trade_count int,trade_cash numeric,dividend numeric,provisional_count int'),rec('closed_sources',zs,'asset_key text,valid boolean,trades int,cash numeric')];
console.log('with '+input.join(',')+','+ctes.replaceAll('p_period',"'ALL'")+" select count(*) cases,count(*) filter(where (r.group_key is not null)<>(c.group_key in ('valid','reentry')) or r.pnl<>case when c.group_key='reentry' then -43 else -48 end) failures from corporate_catalog c left join corporate_resolved r using(group_key);");
