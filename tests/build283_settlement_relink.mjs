import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8'));
await db.exec("create schema auth; create function auth.role() returns text language sql as $$select 'service_role'::text$$; create role anon; create role authenticated; create role service_role;");
async function ins(t,r){const k=Object.keys(r);await db.query(`insert into ${t} (${k}) values (${k.map((_,i)=>'$'+(i+1))})`,Object.values(r))}
await ins('accounts',{id:id(2),user_id:id(1),provider:'kb_securities',mode:'live',is_active:true,created_at:'2030-01-01'});
const tx={id:id(3),account_id:id(2),type:'buy',trade_at:'2030-01-10T03:00:00Z',quantity:10,price:100,gross_amount:-1000,net_amount:-1002,fee:2,tax:0,currency:'USD',source:'api',provider_revision:'SWQA2301',provider_payload:{stnd_is_cd:'US0000000001',dl_dt:'20300110',dl_amt:'1000'}};
const ev={id:id(4),account_id:id(2),source:'SPQM2205',asset_key:'US0000000001',event_type:'buy',order_date:'2030-01-09',settlement_date:'2030-01-10',quantity:10,price:100,gross_amount:1002,currency:'USD',active:true,evidence:{source:'SPQM2205',occurrences:1,order_date:'2030-01-09',settlement_date:'2030-01-10',trade_gross:1000}};
await ins('transactions',tx);await ins('kb_position_evidence',ev);
const run=async()=>(await db.query('select link_kb_order_dates_for_service($1) n',[id(1)])).rows[0].n;
const row=async()=>(await db.query('select * from transactions where id=$1',[id(3)])).rows[0];
await db.exec(fs.readFileSync('supabase/build202_order_price_rounding.sql','utf8'));
assert.equal(await run(),1);
await db.exec('update transactions set settlement_at=null');
assert.equal(await run(),0);assert.equal((await row()).settlement_at,null,'reproduces resync loss');
await db.exec(fs.readFileSync('supabase/build283_settlement_relink.sql','utf8'));
assert.equal(await run(),1);
assert.equal((await row()).settlement_at.toISOString(),'2030-01-09T15:00:00.000Z');
assert.equal((await row()).order_at.toISOString(),'2030-01-08T15:00:00.000Z');
assert.equal(await run(),0,'identical rerun does not rewrite');
for(let n=0;n<3;n++){await db.exec('update transactions set settlement_at=null');assert.equal(await run(),1);assert.equal(await run(),0)}
const before=await row();
for(const [change,restore] of [
 ["order_at='2030-01-07T15:00:00Z'","order_at='2030-01-08T15:00:00Z'"],
 ['quantity=11','quantity=10'],
 ["provider_payload=jsonb_set(provider_payload,'{dl_amt}','\"999\"')","provider_payload=jsonb_set(provider_payload,'{dl_amt}','\"1000\"')"]
]){await db.exec('update transactions set settlement_at=null,'+change);assert.equal(await run(),0);assert.equal((await row()).settlement_at,null);await db.exec('update transactions set '+restore)}
await db.exec('update kb_position_evidence set active=false');assert.equal(await run(),0);await db.exec('update kb_position_evidence set active=true');
await ins('kb_position_evidence',{...ev,id:id(5)});assert.equal(await run(),0,'ambiguous evidence rejected');await db.query('delete from kb_position_evidence where id=$1',[id(5)]);
await ins('transactions',{...tx,id:id(6)});assert.equal(await run(),0,'ambiguous transaction rejected');await db.query('delete from transactions where id=$1',[id(6)]);
await db.exec("update transactions set settlement_at='2030-01-10T15:00:00Z'");assert.equal(await run(),0,'conflicting settlement retained');
await db.exec('update transactions set settlement_at=null');assert.equal(await run(),1);
const after=await row();for(const k of Object.keys(before))assert.deepEqual(after[k],before[k],k+' preserved');
assert.equal((await db.query('select count(*) n from transactions')).rows[0].n,1);
console.log('PASS: reproduced lost settlement; evidence revalidation restores only missing date; repeated resync, ambiguity, conflicts and financial immutability');
await db.close();
