import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build125_complete_history.sql','utf8');
const ctes=sql.slice(sql.indexOf('pending_checks as materialized ('),sql.indexOf('), corporate_catalog('))+')';
const cases=['valid','expired','stale','bad_source','bad_date','wrong_amount','zero_quantity','duplicate','wrong_count','bad_cash','missing_trade','corporate','negative_running','nonzero_start','stale_held'];
const ps=[],es=[],cs=[],zs=[],qs=[],ts=[];
for(const key of cases){
 ps.push({asset_key:key,type:'buy',day:'2026-10-02',quantity:1,price:100,cash:-101});
 const e={account_id:'a',asset_key:key,event_type:'buy',order_date:'2026-10-02',settlement_date:'2026-10-06',quantity:1,price:100,gross_amount:101,currency:'USD',source:'SPQM2205',active:true,evidence:{source:'SPQM2205',order_date:'2026-10-02',settlement_date:'2026-10-06'},fetched_at:'2026-10-04T09:20:00Z'};
 if(key==='expired')e.settlement_date='2026-10-03';
 if(key==='stale')e.fetched_at='2026-10-03T09:20:00Z';
 if(key==='bad_source')e.evidence.source='other';
 if(key==='bad_date')e.evidence.order_date='2026-10-01';
 if(key==='wrong_amount')e.gross_amount=200;
 if(key==='zero_quantity')e.quantity=0;
 es.push(e);if(key==='duplicate')es.push({...e});
 cs.push({asset_key:key,security_id:key,currency:'USD',issue:'거래일 확인 필요',start_qty:key==='nonzero_start'?1:0,end_qty:1,pending_count:key==='wrong_count'?2:1,min_qty:0,corporate_event:key==='corporate',bad_amounts:0,snapshot_quantity_mismatch:false,end_value:150,as_of:key==='stale_held'?'2026-10-03T09:10:00Z':'2026-10-04T09:10:00Z',cutoff:'2026-10-04T09:10:00Z',trade_count:3,trade_cash:-81,dividend:0});
 zs.push({asset_key:key,valid:key!=='bad_cash',trades:2,cash:20});
 qs.push({asset_key:key,min_qty:key==='negative_running'?-1:0,source_valid:true});
 ts.push({security_id:key,type:'buy'},{security_id:key,type:'sell'});if(key==='missing_trade')ts.push({security_id:key,type:'buy'});
}
const j=x=>"'"+JSON.stringify(x)+"'::jsonb";
const rec=(name,data,fields)=>`${name} as(select * from jsonb_to_recordset(${j(data)}) x(${fields}))`;
const input=["account as(select 'a'::text id)","bounds as(select '2026-10-04T09:10:00Z'::timestamptz cutoff)",`keys as(select x id,x asset_key from unnest(array[${cases.map(x=>"'"+x+"'").join(',')}]) x)`,rec('pending',ps,'asset_key text,type text,day date,quantity numeric,price numeric,cash numeric'),rec('pending_evidence',es,'account_id text,asset_key text,event_type text,order_date date,settlement_date date,quantity numeric,price numeric,gross_amount numeric,currency text,source text,active boolean,evidence jsonb,fetched_at timestamptz'),rec('calculated',cs,'asset_key text,security_id text,currency text,issue text,start_qty numeric,end_qty numeric,pending_count int,min_qty numeric,corporate_event boolean,bad_amounts int,snapshot_quantity_mismatch boolean,end_value numeric,as_of timestamptz,cutoff timestamptz,trade_count int,trade_cash numeric,dividend numeric'),rec('closed_sources',zs,'asset_key text,valid boolean,trades int,cash numeric'),rec('ledger_quantity_evidence',qs,'asset_key text,min_qty numeric,source_valid boolean'),rec('dated_transactions',ts,'security_id text,type text')];
console.log('with '+input.join(',')+','+ctes.replaceAll('p_period',"'ALL'").replaceAll('public.kb_position_evidence','pending_evidence')+" select count(*) cases,count(*) filter(where (r.asset_key is not null)<>(k.id='valid') or r.pnl<>69) failures from keys k left join pending_resolved r on r.asset_key=k.id;");
