import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8')+fs.readFileSync('tests/fixtures/period_schema.sql','utf8'));
await db.exec(`create table public.kb_balance_position_evidence(id uuid,account_id uuid,symbol text,observed_at timestamptz,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,source text);
create schema auth;create role authenticated;
create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
grant usage on schema auth to authenticated;grant select on all tables in schema public to authenticated;
alter table accounts enable row level security;create policy own on accounts to authenticated using(user_id=(select auth.uid()));
insert into accounts(id,user_id,provider,mode,is_active,created_at) select md5('a'||i)::uuid,md5('u'||i)::uuid,'kb_securities','live',true,'2020-01-01' from generate_series(1,2)i;
select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);`);
for(const file of ['tests/fixtures/period248.sql','supabase/build249_period_evidence.sql','supabase/build250_date_evidence.sql'])await db.exec(fs.readFileSync(file,'utf8'));
const definition=async()=>(await db.query("select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) d")).rows[0].d;
const original=await definition();
const migration=fs.readFileSync('supabase/build251_domestic_opening.sql','utf8');
await db.exec(migration);await db.exec(migration);
let candidate=await definition();
if(process.env.CORPORATE_EXPERIMENT){
 const patch=fs.readFileSync(process.env.CORPORATE_MIGRATION||'tests/fixtures/period_corporate_candidate_experiment.sql','utf8').replace('a1c5b0dd24c00467912fc425ce351892','b08fe9c5e0bab487b0dc1a64aad25800');
 await db.exec(patch);if(process.env.CORPORATE_MIGRATION)await db.exec(patch);
 candidate=await definition();
}
console.log('Definition hash', (await db.query("select md5(btrim(pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure),E' \n\r\t')) h")).rows[0].h);
const clock=d=>d.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec(`insert into securities(id,symbol,name,currency,isin) values(md5('s')::uuid,'000001','합성 국내 종목','KRW','KR0000000001');
insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) values(md5('h')::uuid,md5('a1')::uuid,md5('s')::uuid,'2026-11-09T03:00:00Z',17,1870,'KRW',1);
insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at) values(md5('a1')::uuid,'2026-11-02','2026-11-02T12:00:00Z'),(md5('a1')::uuid,'2026-11-04','2026-11-04T12:00:00Z');
insert into daily_security_snapshots(account_id,security_id,snapshot_date,quantity,market_value,currency,fx_rate_to_base,updated_at) values
(md5('a1')::uuid,md5('s')::uuid,'2026-11-02',10,1000,'KRW',1,'2026-11-02T12:00:00Z'),
(md5('a1')::uuid,md5('s')::uuid,'2026-11-04',15,1650,'KRW',1,'2026-11-04T12:00:00Z');
insert into daily_security_prices(security_id,price_date,close,currency) values(md5('s')::uuid,'2026-11-02',100,'KRW');
insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
select md5(tag)::uuid,md5('a1')::uuid,md5('s')::uuid,'buy',settled::timestamptz,null,qty,price,-qty*price,0,0,'KRW','api',
jsonb_build_object('stnd_is_cd','KR0000000001','dl_dt',replace(settled,'-',''),'dl_amt',(qty*price)::text,'ec_amt',(qty*price)::text,'fee','0')
from (values('opening','2026-11-04',5,100),('period','2026-11-09',2,110)) v(tag,settled,qty,price);
insert into realized_pnl_events(id,account_id,security_id,provider_event_id,realized_date,quantity,sell_price,buy_amount,sell_amount,fee,tax,currency,source,provider_payload)
select md5(tag||'e')::uuid,md5('a1')::uuid,md5('s')::uuid,'KB:SSQM2442:'||tag,day::date,qty,price,qty*price,0,0,0,'KRW','api',
jsonb_build_object('stnd_is_cd','KR0000000001','trd_dl_ccd','02','trd_dt',replace(day,'-',''))
from (values('opening','2026-11-02',5,100),('period','2026-11-05',2,110)) v(tag,day,qty,price);
-- An identically shaped event belonging to another user cannot make our match ambiguous.
insert into realized_pnl_events select md5('foreign')::uuid,md5('a2')::uuid,security_id,provider_event_id,realized_date,quantity,sell_price,buy_price,sell_amount,buy_amount,fee,tax,realized_pnl,return_rate,currency,source,provider_payload,created_at,updated_at from realized_pnl_events where id=md5('openinge')::uuid;`);
async function result(d,period='1W'){
 await db.exec('reset role');await db.exec(clock(d));await db.exec('set role authenticated');
 const r=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;await db.exec('reset role');return r;
}
const before=await result(original),after=await result(candidate);
assert.equal(before.items[0].reason,'시작 보유수량 확인 필요');assert.equal(before.items[0].pnl_krw,null);
assert.equal(after.items[0].reason,null);assert.equal(after.items[0].opening_basis,'historical_close_quantity_reconciled');
assert.equal(Number(after.items[0].pnl_krw),150);assert.equal(after.complete,true);
assert.equal(Number(after.items[0].opening_price),100);assert.equal(after.items[0].opening_price_date,'2026-11-02');
fs.mkdirSync('mobile-artifacts/build251',{recursive:true});fs.writeFileSync('mobile-artifacts/build251/rpc-fixture.json',JSON.stringify(after));
for(const p of ['오늘','THIS_MONTH','1M','3M','6M','1Y','ALL'])assert.deepEqual(await result(candidate,p),await result(original,p),'unchanged '+p);
const cases=[
 ['wrong settlement quantity',"update daily_security_snapshots set quantity=11 where snapshot_date='2026-11-02'"],
 ['stale opening snapshot',"update daily_security_snapshots set updated_at=updated_at-interval '1 hour' where snapshot_date='2026-11-02'"],
 ['stale later snapshot',"update daily_security_snapshots set updated_at=updated_at-interval '1 hour' where snapshot_date='2026-11-04'"],
 ['wrong later quantity',"update daily_security_snapshots set quantity=14 where snapshot_date='2026-11-04'"],
 ['different account later snapshot',"update daily_security_snapshots set account_id=md5('a2')::uuid where snapshot_date='2026-11-04'"],
 ['quote not exact preceding day',"update daily_security_prices set price_date='2026-11-01'"],
 ['missing quote',"delete from daily_security_prices"],
 ['invalid quote',"update daily_security_prices set close=0"],
 ['invalid KRW FX',"update daily_security_snapshots set fx_rate_to_base=2 where snapshot_date='2026-11-02'"],
 ['unverified cash',"update transactions set provider_payload=provider_payload||'{\"ec_amt\":\"499\"}' where id=md5('opening')::uuid"],
 ['missing broker execution date',"delete from realized_pnl_events where id=md5('openinge')::uuid"],
 ['ambiguous broker execution date',"insert into realized_pnl_events select md5('dupe')::uuid,account_id,security_id,provider_event_id||'dup',realized_date,quantity,sell_price,buy_price,sell_amount,buy_amount,fee,tax,realized_pnl,return_rate,currency,source,provider_payload,created_at,updated_at from realized_pnl_events where id=md5('openinge')::uuid"],
 ['trade on observation date',"update realized_pnl_events set realized_date='2026-11-04',provider_payload=provider_payload||'{\"trd_dt\":\"20261104\"}' where id=md5('periode')::uuid"],
 ['corporate event',"insert into transactions(id,account_id,security_id,type,trade_at,order_at,currency) values(md5('corporate')::uuid,md5('a1')::uuid,md5('s')::uuid,'transfer_in','2026-11-03','2026-11-03','KRW')"],
];
for(const [name,sql] of cases){await db.exec('begin');await db.exec(sql);const r=await result(candidate);assert.notEqual(r.items[0].opening_basis,'historical_close_quantity_reconciled',name);assert.deepEqual(r,await result(original),name+' retains prior handling');await db.exec('rollback');}
await db.exec("select set_config('request.jwt.claim.sub',md5('u2')::uuid::text,false)");assert.equal(((await result(candidate)).items||[]).length,0,'other owner has no first-owner positions');
await db.exec("select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false)");
// Independent archived native balance, not a later average cost or current balance.
await db.exec(`truncate realized_pnl_events;
update securities set symbol='NATIVE',currency='USD',isin='US0000000001';
update holdings set currency='USD',fx_rate_to_base=1000;
update daily_security_prices set currency='USD';
update daily_security_snapshots set currency='USD',fx_rate_to_base=1000;
update daily_security_snapshots set quantity=14 where snapshot_date='2026-11-04';
update transactions set currency='USD',order_at=case when id=md5('opening')::uuid then '2026-11-02'::timestamptz else '2026-11-05'::timestamptz end,provider_payload=provider_payload||'{"stnd_is_cd":"US0000000001"}';
insert into fx_rates(rate_date,base_currency,quote_currency,rate,source) values('2026-11-02','USD','KRW',1000,'synthetic');
insert into kb_position_evidence(id,account_id,asset_key,symbol,source,source_key,event_type,order_date,settlement_date,quantity,price,gross_amount,currency,evidence,active)
values(md5('native-e')::uuid,md5('a1')::uuid,'US0000000001','NATIVE','SPQM2205','synthetic-unique','buy','2026-11-02','2026-11-04',5,100,500,'USD','{"occurrences":1}',true);
insert into kb_balance_position_evidence(id,account_id,symbol,observed_at,settled_quantity,effective_quantity,pending_buy_quantity,pending_sell_quantity,source)
values(md5('native-b')::uuid,md5('a1')::uuid,'NATIVE','2026-11-03T01:20:00Z',10,15,5,0,'SSQM2952');`);
assert.equal((await result(original)).items[0].reason,'시작 보유수량 확인 필요');
const native=await result(candidate);assert.equal(native.items[0].reason,null);assert.equal(Number(native.items[0].pnl_krw),150000);assert.equal(Number(native.items[0].pnl_local),150);assert.equal(native.items[0].opening_price_date,'2026-11-02');
for(const p of ['오늘','THIS_MONTH','1M','3M','6M','1Y','ALL'])assert.deepEqual(await result(candidate,p),await result(original,p),'native unchanged '+p);
const nativeCases=[
 ['before extended close',"update kb_balance_position_evidence set observed_at='2026-11-03T00:59:59Z'"],
 ['at next premarket',"update kb_balance_position_evidence set observed_at='2026-11-03T09:00:00Z'"],
 ['different boundary day',"update kb_balance_position_evidence set observed_at='2026-11-04T01:20:00Z'"],
 ['wrong native owner',"update kb_balance_position_evidence set account_id=md5('a2')::uuid"],
 ['wrong execution owner',"update kb_position_evidence set account_id=md5('a2')::uuid"],
 ['wrong native source',"update kb_balance_position_evidence set source='manual'"],
 ['wrong execution source',"update kb_position_evidence set source='manual'"],
 ['inactive executions',"update kb_position_evidence set active=false"],
 ['ambiguous execution',"update kb_position_evidence set evidence='{\"occurrences\":2}'"],
 ['invalid component arithmetic',"update kb_balance_position_evidence set settled_quantity=11"],
 ['offsetting new orders',"update kb_balance_position_evidence set pending_buy_quantity=6,pending_sell_quantity=1"],
 ['period order cannot establish opening',"update kb_position_evidence set order_date='2026-11-03'"],
 ['already settled execution',"update kb_position_evidence set settlement_date='2026-11-03'"],
 ['missing historical price',"delete from daily_security_prices"],
 ['corporate boundary',"insert into transactions(id,account_id,security_id,type,trade_at,order_at,currency) values(md5('corporate')::uuid,md5('a1')::uuid,md5('s')::uuid,'transfer_in','2026-11-02','2026-11-02','USD')"],
];
for(const [name,sql] of nativeCases){await db.exec('begin');await db.exec(sql);const r=await result(candidate);assert.notEqual(r.items[0].opening_basis,'historical_close_quantity_reconciled',name);assert.deepEqual(r,await result(original),name+' retains prior handling');await db.exec('rollback');}
await db.exec(`begin;
update holdings set as_of=as_of-interval '5 months';
update transactions set trade_at=trade_at-interval '5 months',order_at=order_at-interval '5 months';
update daily_account_snapshots set snapshot_date=(snapshot_date-interval '5 months')::date,snapshot_at=snapshot_at-interval '5 months';
update daily_security_snapshots set snapshot_date=(snapshot_date-interval '5 months')::date,updated_at=updated_at-interval '5 months';
update daily_security_prices set price_date=(price_date-interval '5 months')::date;
update fx_rates set rate_date=(rate_date-interval '5 months')::date;
update kb_position_evidence set order_date=(order_date-interval '5 months')::date,settlement_date=(settlement_date-interval '5 months')::date;
update kb_balance_position_evidence set observed_at='2026-06-03T00:00:00Z';`);
const summer=candidate.replaceAll('now()',"timestamptz '2026-06-09 12:00:00+09'");
assert.equal((await result(summer)).items[0].reason,null,'summer extended session closes at UTC00:00');
await db.exec("update kb_balance_position_evidence set observed_at='2026-06-02T23:59:59Z'");
assert.equal((await result(summer)).items[0].reason,'시작 보유수량 확인 필요','summer pre-close observation rejected');await db.exec('rollback');
console.log('Build251: domestic + native boundaries, 29 rejection cases, seven unchanged periods per fixture, owner isolation and idempotence passed');
await db.close();
