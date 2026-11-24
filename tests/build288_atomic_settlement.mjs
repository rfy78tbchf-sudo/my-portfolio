import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),user='00000000-0000-0000-0000-000000000001';
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8'));
await db.exec(`create schema auth;
create function auth.role() returns text language sql as $$select coalesce(current_setting('test.role',true),'service_role')$$;
create role anon; create role authenticated; create role service_role;
alter table accounts add unique(user_id,provider,provider_account_ref,mode);
alter table accounts alter id set default gen_random_uuid();
alter table securities add unique(symbol,market);
alter table securities alter id set default gen_random_uuid();
alter table transactions add unique(account_id,external_id);
alter table transactions alter id set default gen_random_uuid();
alter table kb_position_evidence add unique(account_id,source,source_key);
alter table kb_position_evidence alter id set default gen_random_uuid();
alter table kb_position_evidence alter active set default true;
create table kb_backfill_months(user_id uuid,month date,evidence_rows int,evidence_checked_at timestamptz);
create table sync_logs(account_id uuid,started_at timestamptz,finished_at timestamptz,status text,scope text,rows_read int,rows_written int,detail jsonb);`);
await db.exec(fs.readFileSync('supabase/build136_security_currency.sql','utf8').split('-- Repair only metadata')[0]);
function definition(file,name){const text=fs.readFileSync(file,'utf8'),start=text.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0);return text.slice(start,text.indexOf('$function$;',text.indexOf('$function$',start)+10)+11);}
const definitions={
 save_kb_position_evidence_for_service:definition('supabase/reconciliation_build44.sql','save_kb_position_evidence_for_service'),
 reactivate_kb_evidence_for_service:definition('supabase/reconciliation_build44_source_revisions.sql','reactivate_kb_evidence_for_service'),
 finish_kb_evidence_month_for_service:definition('supabase/reconciliation_build44_source_revisions.sql','finish_kb_evidence_month_for_service'),
 record_kb_evidence_month_for_service:definition('supabase/reconciliation_build44_metadata.sql','record_kb_evidence_month_for_service'),
 link_kb_order_dates_for_service:definition('supabase/build283_settlement_relink.sql','link_kb_order_dates_for_service')
};
for(const sql of Object.values(definitions))await db.exec(sql);
const input={external_id:'synthetic-settlement-1',symbol:'SYNTH',name:'Synthetic',market:'NASDAQ',country:'US',trade_at:'2030-01-10T03:00:00Z',settlement_at:null,type:'buy',quantity:10,price:100,gross_amount:-1000,fee:2,tax:0,net_amount:-1002,currency:'USD',payload_hash:'synthetic',provider_payload:{stnd_is_cd:'US0000000001',dl_dt:'20300110',dl_amt:'1000'}};
const evidence={source:'SPQM2205',source_key:'synthetic-old',asset_key:'US0000000001',event_type:'buy',order_date:'2030-01-09',settlement_date:'2030-01-10',quantity:10,price:100,gross_amount:1002,currency:'USD',evidence:{source:'SPQM2205',occurrences:1,order_date:'2030-01-09',settlement_date:'2030-01-10',trade_gross:1000}};
const oldApply=async()=>db.query("select apply_kb_history_month_for_service($1,'2030-01',$2,'[]','[]','[]')",[user,JSON.stringify([input])]);
const apply=async(item=input,ev=[evidence])=>(await db.query("select apply_kb_history_bundle_for_service($1,'2030-01',$2,'[]','[]','[]',$3) result",[user,JSON.stringify([item]),JSON.stringify(ev)])).rows[0].result;
const row=async()=>(await db.query('select * from transactions')).rows[0];
await oldApply();
await db.query('select save_kb_position_evidence_for_service($1,$2)',[user,JSON.stringify([evidence])]);
await db.query('select link_kb_order_dates_for_service($1)',[user]);
const saved=await row();
assert.equal(saved.order_at.toISOString(),'2030-01-08T15:00:00.000Z');
assert.equal(saved.settlement_at.toISOString(),'2030-01-09T15:00:00.000Z');
await oldApply();assert.equal((await row()).settlement_at,null,'old writer commits date gap before separate RPC');
await db.exec(fs.readFileSync('supabase/migrations/20261124033242_build288_atomic_history_bundle.sql','utf8'));
await db.query("insert into kb_backfill_months(user_id,month) values($1,'2030-01-01')",[user]);
for(let i=0;i<3;i++){
 const result=await apply();assert.equal(result.evidence_written,1);assert.equal(result.order_dates_linked,1);
 const current=await row();
 for(const key of ['id','order_at','settlement_at','quantity','price','gross_amount','net_amount','fee','tax','currency','provider_payload'])assert.deepEqual(current[key],saved[key],key);
 assert.equal((await db.query('select count(*) n from transactions')).rows[0].n,1);
}
const snapshot=async()=>({tx:(await db.query('select * from transactions order by id')).rows,evidence:(await db.query('select * from kb_position_evidence order by id')).rows,logs:(await db.query('select * from sync_logs order by started_at')).rows,metadata:(await db.query('select * from kb_backfill_months')).rows});
for(const [name,args,returns] of [
 ['save_kb_position_evidence_for_service','p_user_id uuid,p_rows jsonb','integer'],
 ['finish_kb_evidence_month_for_service','p_user_id uuid,p_month text,p_source_keys jsonb','integer'],
 ['link_kb_order_dates_for_service','p_user_id uuid','integer'],
 ['record_kb_evidence_month_for_service','p_user_id uuid,p_month text,p_count integer','void']
]){
 const before=await snapshot();
 await db.exec(`create or replace function public.${name}(${args}) returns ${returns} language plpgsql as $$begin raise exception 'SYNTHETIC_FAILURE'; end$$;`);
 await assert.rejects(apply({...input,fee:3,net_amount:-1003}),/SYNTHETIC_FAILURE/);
 assert.deepEqual(await snapshot(),before,name+' failure rolls back ledger, evidence, dates, logs and metadata');
 await db.exec(definitions[name]);
}
const corrected={...evidence,source_key:'synthetic-correction',order_date:'2030-01-08',evidence:{...evidence.evidence,order_date:'2030-01-08'}};
await apply(input,[corrected]);
assert.equal((await row()).settlement_at,null,'retire old evidence before linking; conflicting known order cannot restore old settlement');
assert.deepEqual((await row()).order_at,saved.order_at);
assert.equal((await db.query("select active from kb_position_evidence where source_key='synthetic-old'")).rows[0].active,false);
await apply();assert.deepEqual((await row()).settlement_at,saved.settlement_at);
await apply(input,[]);assert.equal((await row()).settlement_at,null,'empty complete evidence set cannot retain prior settlement');
await apply({...input,quantity:11});assert.equal((await row()).settlement_at,null,'changed quantity stays unverified');
await apply();
const stable=await snapshot();
const batch=Array.from({length:301},(_,i)=>({...evidence,source_key:'batch-'+i,asset_key:'US0000000002',order_date:i===300?'invalid-date':'2030-01-09'}));
await assert.rejects(apply({...input,fee:3},batch),/date/);
assert.deepEqual(await snapshot(),stable,'second evidence chunk failure rolls back first chunk');
await assert.rejects(apply(input,Array(2001).fill(evidence)),/INVALID_MONTH_EVIDENCE/);
await assert.rejects(apply(input,null),/INVALID_HISTORY_BUNDLE/);
assert.deepEqual(await snapshot(),stable);
await db.exec("set test.role='authenticated'");await assert.rejects(apply(),/SERVICE_ROLE_REQUIRED/);
assert.deepEqual(await snapshot(),stable);
const privileges=(await db.query("select has_function_privilege('anon','public.apply_kb_history_bundle_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)','EXECUTE') anon,has_function_privilege('authenticated','public.apply_kb_history_bundle_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)','EXECUTE') authenticated,has_function_privilege('service_role','public.apply_kb_history_bundle_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb)','EXECUTE') service")).rows[0];
assert.deepEqual(privileges,{anon:false,authenticated:false,service:true});
await db.close();
console.log('PASS atomic history bundle: old date gap reproduced; repeated literal dates/cash; fresh correction before linking; all failure stages and second chunk roll back; missing evidence, quantity mismatch and service-only permissions');
