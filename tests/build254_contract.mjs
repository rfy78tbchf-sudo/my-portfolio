import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const sql=fs.readFileSync('supabase/build254_nav_contract.sql','utf8');
await db.exec(sql.slice(0,sql.indexOf('create or replace function public.get_live_nav_reconciliation')));
// Fixed, independently calculated expected values; no implementation-generated oracle.
for(const [open,close,flow,components,expected,match] of [
 [10000000,11000000,0,1000000,1000000,true],
 [10000000,12000000,2000000,0,0,true],
 [10000000,9000000,-1000000,0,0,true],
 [10000000,10000000,0,0,0,true], // cash -> shares, internal transfer
 [10000,10120,0,120,120,true], // dividend 100 + interest 30 - fee 10
 [1300000,1400000,0,100000,100000,true], // USD 1000, FX 1300 -> 1400
 [10000,12000,2000,0,0,true], // externally transferred stock
 [10000,10000,0,0,0,true], // 2:1 split, unchanged value
 [10000,10030,0,20,30,false],
 [10000,10030,0,null,30,null],
 [null,10030,0,null,null,null]
]){
 const r=(await db.query('select portfolio_reconcile_values($1,$2,$3,$4) r',[open,close,flow,components])).rows[0].r;
 assert.equal(r.asset_pnl,expected);assert.equal(r.arithmetic_matches,match);
}
for(const [p,day,expected] of [['1W','2026-11-09','2026-11-03'],['오늘','2026-11-09','2026-11-09'],['THIS_MONTH','2026-11-09','2026-11-01'],['6M','2026-11-09','2026-05-09'],['YTD','2027-01-01','2027-01-01'],['1M','2024-03-31','2024-02-29'],['THIS_WEEK','2026-11-08','2026-11-02']]){
 const r=(await db.query('select portfolio_period_start($1,$2)::text s',[p,day])).rows[0];assert.equal(r.s,expected);
}
await db.exec(fs.readFileSync('supabase/build254_snapshot_guard.sql','utf8'));
const day=(await db.query("select timezone('Asia/Seoul',now())::date::text d")).rows[0].d;
const uid='00000000-0000-0000-0000-000000000001';
for(const [date,holdings,summary] of [[day,[],{}],['2000-01-01',[],{}],[day,null,{}],[day,[{symbol:'A'}],{total_assets:100,cash:100,securities_value:0,invested_capital:0,unrealized_pnl:0}]]){
 await assert.rejects(db.query('select apply_kb_current_snapshot_for_service($1,$2,$3,$4)',[uid,date,holdings,summary]));
}
await db.exec(`create table public.accounts(id uuid,user_id uuid);create table public.sync_logs(account_id uuid,scope text,status text,detail jsonb);
insert into accounts values('${uid}','${uid}');insert into sync_logs values('${uid}','kb_current_snapshot','success','{"source_requested_at":"2030-01-02T00:00:00Z"}');`);
for(let i=0;i<3;i++){
 const summary={total_assets:100,cash:100,securities_value:0,invested_capital:0,unrealized_pnl:0,source_requested_at:'2030-01-01T00:00:00Z'};
 const r=(await db.query('select apply_kb_current_snapshot_for_service($1,$2,$3,$4) r',[uid,day,[],summary])).rows[0].r;
 assert.equal(r.skipped,true);assert.equal(r.reason,'SUPERSEDED_BALANCE_RESPONSE');
}
assert.equal((await db.query('select count(*)::int n from sync_logs')).rows[0].n,1);
await db.close();
const worker=fs.readFileSync('supabase/functions/kb-sync-worker/index.ts','utf8');
const fn=worker.slice(worker.indexOf('function assertCompleteBalance'),worker.indexOf('async function syncCurrent'));
const context=vm.createContext({n:v=>Number(v)||0});vm.runInContext(stripTypeScriptTypes(fn),context);
const domestic={dataBody:{Record1:[],nt_asts_val_amt:'1,000',val_amt_sum:0,dy_tfnd:1000,fcrncy_tfnd_krw_exch_amt:0,byng_amt_sum:0,val_pl_sum:0}};
const overseas={dataBody:{Record2:[]}};
context.assertCompleteBalance(domestic,overseas);
for(const key of ['nt_asts_val_amt','val_amt_sum','dy_tfnd','fcrncy_tfnd_krw_exch_amt','byng_amt_sum','val_pl_sum']){
 for(const value of [undefined,null,'','garbage']){
  const d=structuredClone(domestic);d.dataBody[key]=value;assert.throws(()=>context.assertCompleteBalance(d,overseas));
 }
}
assert.throws(()=>context.assertCompleteBalance({},overseas));
assert.throws(()=>context.assertCompleteBalance(domestic,{}));
assert.throws(()=>context.assertCompleteBalance(domestic,{dataBody:{Record2:[],nxt_key:'next'}}));
const row={is_cd:'XYZ',mkt_clsf:'NAS',frgn_hld_q_p6:1,krw_val_amt:100,std_exch_r:1300};
context.assertCompleteBalance(domestic,{dataBody:{Record2:[row]}});
assert.throws(()=>context.assertCompleteBalance(domestic,{dataBody:{Record2:[row,row]}}));
assert.throws(()=>context.assertCompleteBalance(domestic,{dataBody:{Record2:[{...row,std_exch_r:0}]}}));
const html=fs.readFileSync('index.html','utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
console.log('Build254: independent arithmetic/date fixtures, missing/duplicate/paginated balance rejection and JS compilation PASS');
