import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8')+fs.readFileSync('tests/fixtures/period_schema.sql','utf8'));
await db.exec(`create schema auth;create role authenticated;create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
alter table accounts add primary key(id);alter table realized_pnl_events add primary key(id);
grant usage on schema auth to authenticated;grant select on all tables in schema public to authenticated;
alter table accounts enable row level security;create policy own on accounts to authenticated using(user_id=(select auth.uid()));
alter table transactions enable row level security;create policy own on transactions to authenticated using(exists(select 1 from accounts a where a.id=transactions.account_id and a.user_id=(select auth.uid())));
alter table realized_pnl_events enable row level security;create policy own on realized_pnl_events to authenticated using(exists(select 1 from accounts a where a.id=realized_pnl_events.account_id and a.user_id=(select auth.uid())));
insert into accounts(id,user_id,provider,mode,is_active,created_at) select md5('a'||i)::uuid,md5('u'||i)::uuid,'kb_securities','live',true,'2020-01-01' from generate_series(1,2)i;
select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);`);
await db.exec(fs.readFileSync('tests/fixtures/period248.sql','utf8'));
await db.exec(fs.readFileSync('supabase/build249_period_evidence.sql','utf8'));
const getDefinition=async()=>(await db.query("select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) d")).rows[0].d;
await db.exec(fs.readFileSync('supabase/build250_date_evidence.sql','utf8'));
const original=await getDefinition();
const migration=fs.readFileSync('tests/fixtures/period_corporate_candidate_experiment.sql','utf8');
await db.exec(migration);await db.exec(migration);
const changed=await getDefinition();
const base=original.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const candidate=changed.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");

await db.exec(`truncate transactions,holdings,securities,realized_pnl_events;
insert into securities(id,symbol,name,currency,isin) values(md5('s1')::uuid,'000001','Synthetic IPO','KRW','KR0000000001');
insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) values(md5('h1')::uuid,md5('a1')::uuid,md5('s1')::uuid,'2026-11-09T03:00:00Z',0,0,'KRW',1);
insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
select md5(tag)::uuid,md5('a1')::uuid,md5('s1')::uuid,typ,dt::timestamptz,dt::timestamptz,qty,100,amt,0,0,'KRW','api',jsonb_build_object('smry_nm',summary,'dl_amt',gross,'ec_amt',cash,'fee','0','stnd_is_cd','KR0000000001')
from (values ('pay','other','2026-11-03',10,-500,'공모불입 출금','500','500'),('refund','other','2026-11-04',2,300,'공모주환불금 입금','300','300'),('receipt','transfer_in','2026-11-05',2,0,'공모주 입고','','0'),('sale','sell','2026-11-06',2,200,'매도','200','200')) v(tag,typ,dt,qty,amt,summary,gross,cash);`);
const inspect=definition=>{const body=definition.split('$function$')[1];return body.slice(0,body.indexOf('), calculated as'))+') select (select count(*) from verified_ipo) ipo_count, (select count(*) from evidence where corporate_event) corporate_count';};
const cases=[['valid',null,1,0],['malformed',"update transactions set provider_payload=provider_payload||jsonb_build_object('ec_amt','499') where id=md5('pay')::uuid",0,1],['before',"delete from transactions where type='other';update transactions set trade_at='2026-10-01',order_at='2026-10-01' where id=md5('receipt')::uuid",0,1],['future',"update transactions set trade_at='2027-01-01',order_at='2027-01-01' where id=md5('receipt')::uuid",0,0]];
for(const [name,mutation,ipo,corporate] of cases){
 await db.exec('reset role');if(mutation)await db.exec(mutation);
 for(const period of ['오늘','1W','1M','3M','6M','1Y','ALL']){
 await db.exec(base);await db.exec('set role authenticated');const before=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
 await db.exec('reset role');await db.exec(candidate);await db.exec('set role authenticated');const after=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;assert.deepEqual(after,before,name+'/'+period);await db.exec('reset role');
 }
 await db.exec(candidate);await db.exec('set role authenticated');const flags=(await db.query(inspect(candidate).replaceAll('p_period',"'ALL'"))).rows[0];assert.equal(Number(flags.ipo_count),ipo,name);if(corporate!==null)assert.equal(Number(flags.corporate_count),corporate,name);if(name==='before'||name==='future'){const week=(await db.query(inspect(candidate).replaceAll('p_period',"'1W'"))).rows[0];assert.equal(Number(week.corporate_count),0,name+' week boundary');}await db.exec('reset role');
}
console.log('Full-function IPO exclusion: valid, malformed, prior-boundary and future cases equal across seven periods');await db.close();
