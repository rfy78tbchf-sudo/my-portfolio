import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';import {PGlite} from '@electric-sql/pglite';
const src=fs.readFileSync('supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const code=section('function n(','async function fetchCurrent(')+section('function assertCompleteBalance','function ymd(');
const productionSchema=process.argv.includes('--uuid-schema');
const batchTable=productionSchema?'kb_position_response_batches':'evidence_batch_273';
const db=new PGlite(),u='00000000-0000-0000-0000-000000000001',a='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select '${u}'::uuid$$;
create table accounts(id uuid,user_id uuid,mode text,provider text);create table account_observations(id uuid,account_id uuid,fetched_at timestamptz);create table sync_logs(account_id uuid,started_at timestamptz,scope text,status text,detail jsonb);
insert into accounts values('${a}','${u}','live','kb_securities');`);
if(productionSchema)await db.exec('grant select on accounts to authenticated;alter table accounts add primary key(id);alter table account_observations add primary key(id)');
for(const f of productionSchema?['position_response_schema273.sql']:['evidence_batch_273.sql','evidence_batch_273_access.sql','batch-worker-binding273.sql'])await db.exec(fs.readFileSync('experiments/'+f,'utf8'));
const kr={is_cd:'123456',crncy_cd:'KRW',hld_q:'2',ec_q:'2',nstmt_b_q:'0',nstmt_s_q:'0',val_amt:'200',byng_amt:'180',ordr_psbl_q:'2'};
const foreign={is_cd:'XYZ',crncy_cd:'USD',hld_q:'2',ec_q:'2',nstmt_b_q:'0',nstmt_s_q:'0',val_amt:'2600'};
const d=rs=>({dataBody:{Record1:rs,nt_asts_val_amt:'10000',val_amt_sum:rs.length?'2800':'0',dy_tfnd:'7200',fcrncy_tfnd_krw_exch_amt:'0',byng_amt_sum:'180',val_pl_sum:'20'}});
const o={dataBody:{Record2:[{is_cd:'XYZ',mkt_clsf:'NAS',crncy_clsf_nm:'USD',frgn_hld_q_p6:'2',krw_val_amt:'2600',std_exch_r:'1300'}]}};
let counter=0;
async function run(domestic,overseas){
 await db.exec(`delete from ${batchTable};delete from account_observations;delete from sync_logs`);
 let envelope,calls=[];
 const context=vm.createContext({Date,Intl,fetchCurrent:async()=>({appKey:'synthetic',token:'synthetic',domesticRaw:domestic,overseasRaw:overseas}),fetchNativeBalance:async()=>null,attachNativePrices:x=>x,
 adminRpc:async(name,p)=>{calls.push(name);
 if(name==='apply_kb_current_snapshot_for_service'){
 const id='00000000-0000-0000-0000-'+String(++counter).padStart(12,'0');
 await db.query('insert into account_observations values($1,$2,$3)',[id,a,p.p_summary.source_requested_at]);
 await db.query("insert into sync_logs values($1,$2,'kb_current_snapshot','success',$3)",[a,p.p_summary.source_requested_at,JSON.stringify({source_requested_at:p.p_summary.source_requested_at})]);
 }
 if(name==='save_kb_position_batch_for_response_for_service'){
 envelope=JSON.parse(JSON.stringify(p));
 await db.query('select save_kb_position_batch_for_response_for_service($1,$2,$3,$4,$5)',[u,p.p_source_requested_at,p.p_complete,JSON.stringify(p.p_rows),JSON.stringify(p.p_validation)]);
 }return {ok:true};}});
 vm.runInContext(stripTypeScriptTypes(code),context);await context.syncCurrent(u);
 const stored=(await db.query(`select complete,rows from ${batchTable}`)).rows[0];assert.equal(stored.complete,envelope.p_complete);assert.deepEqual(stored.rows,envelope.p_rows);
 assert.ok(!calls.includes('save_kb_positions_for_response_for_service'));return envelope;
}
let r=await run(d([kr,foreign]),o);assert.equal(r.p_complete,true);assert.equal(r.p_rows[1].effective_quantity,2);
r=await run(d([kr,{...foreign,ec_q:undefined}]),o);assert.equal(r.p_complete,false);assert.equal(r.p_rows[1].effective_quantity,null,'foreign missing stays null through actual worker and SQL');
r=await run(d([kr,{...foreign,hld_q_p6:'0.5'}]),o);assert.equal(r.p_complete,false);assert.equal(r.p_rows[1].settled_quantity,null,'conflicting aliases do not pick arbitrary first');
r=await run(d([kr]),o);assert.equal(r.p_complete,false);assert.ok(r.p_validation.reasons.includes('SNAPSHOT_POSITION_UNCOVERED'));
const fractionalOverseas={dataBody:{Record2:[{...o.dataBody.Record2[0],frgn_hld_q_p6:'0.3'}]}};
r=await run(d([kr,{...foreign,hld_q:'0.1',ec_q:'0.3',nstmt_b_q:'0.2'}]),fractionalOverseas);
assert.equal(r.p_complete,true,'literal decimal 0.1 settled + 0.2 pending = 0.3 effective');
assert.equal(r.p_rows[1].effective_quantity,0.3);
r=await run(d([kr,{...foreign,hld_q:'0.1',ec_q:'0.300001',nstmt_b_q:'0.2'}]),{dataBody:{Record2:[{...o.dataBody.Record2[0],frgn_hld_q_p6:'0.300001'}]}});
assert.equal(r.p_complete,false,'a real 0.000001 mismatch is not rounded away');
r=await run(d([]),{dataBody:{Record2:[]}});assert.equal(r.p_complete,true);assert.deepEqual(r.p_rows,[]);
if(productionSchema){
 const source=(await db.query('select fetched_at from account_observations')).rows[0].fetched_at;
 const metadata={complete:true,reasons:[],source:'SSQM2952',version:'response-adapter-273'};
 const save=(user=u,complete=true,rows=[],validation=metadata)=>db.query('select save_kb_position_batch_for_response_for_service($1,$2,$3,$4,$5)',[user,source,complete,JSON.stringify(rows),JSON.stringify(validation)]);
 await save();assert.equal((await db.query('select count(*)::int n from kb_position_response_batches')).rows[0].n,1);
 await assert.rejects(save(u,false,[],{...metadata,complete:false,reasons:['missing']}),/CONFLICTING_RETRY/);
 await assert.rejects(save(a),/SOURCE_BINDING_UNAVAILABLE/);
 await assert.rejects(save(u,null),/INVALID_BATCH/);
 await db.exec('set role authenticated');
 assert.equal((await db.query('select count(*)::int n from kb_position_response_batches')).rows[0].n,1);
 await assert.rejects(save(),/permission denied/);
 await assert.rejects(db.exec('delete from kb_position_response_batches'),/permission denied/);
 await db.exec('reset role');
 await db.exec(`create or replace function auth.uid() returns uuid language sql as $$select '${a}'::uuid$$;set role authenticated`);
 assert.equal((await db.query('select count(*)::int n from kb_position_response_batches')).rows[0].n,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from kb_position_response_batches'),/permission denied/);
 await db.exec('reset role;set role service_role');await save();
 await assert.rejects(db.exec('delete from kb_position_response_batches'),/permission denied/);
 await db.exec('reset role');
 await assert.rejects(db.exec('delete from account_observations'),/foreign key/);
 await assert.rejects(db.exec('delete from accounts'),/foreign key/);
 const oldAt=new Date(new Date(source).getTime()-86400000).toISOString(),oldId='99999999-0000-0000-0000-000000000001';
 await db.query('insert into account_observations values($1,$2,$3)',[oldId,a,oldAt]);
 await db.query("insert into sync_logs values($1,$2,'kb_current_snapshot','success',$3)",[a,oldAt,JSON.stringify({source_requested_at:oldAt})]);
 const oldRows=[{symbol:'TEST',currency:'USD',source:'SSQM2952',effective_quantity:0.5,settled_quantity:0.5,pending_buy_quantity:0,pending_sell_quantity:0}];
 await db.query('select save_kb_position_batch_for_response_for_service($1,$2,true,$3,$4)',[u,oldAt,JSON.stringify(oldRows),JSON.stringify(metadata)]);
 assert.deepEqual((await db.query('select read_batch_at_273($1,$2) r',[a,source])).rows[0].r.rows,[],'late old batch cannot replace newest empty');
 assert.equal((await db.query('select read_batch_at_273($1,$2) r',[a,oldAt])).rows[0].r.rows[0].effective_quantity,0.5);
 console.log('PASS UUID/FK schema, retry conflict, missing owner, null completeness, owner RLS, anon/auth writes denied and service wrapper only');
}
await db.close();console.log('PASS actual syncCurrent → bound SQL batch: complete mixed, foreign null, alias conflict, uncovered foreign, complete empty; no old per-symbol writer');
