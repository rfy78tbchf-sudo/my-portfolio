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
for(const size of [20,100]){
 await db.exec(`truncate transactions,holdings,securities,realized_pnl_events;
 insert into securities(id,symbol,name,currency,isin) select md5('s'||g)::uuid,lpad(g::text,6,'0'),'Synthetic '||g,'KRW','KR'||lpad(g::text,10,'0') from generate_series(1,${size}) g;
 insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) select md5('h'||g)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,'2026-11-09T03:00:00Z',0,0,'KRW',1 from generate_series(1,${size}) g;
 insert into transactions(id,account_id,security_id,type,trade_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-01-01'+(n*30+12)*interval '1 day',1,100+n,case when n%2=1 then -(100+n) else 100+n end,0,0,'KRW','api',
 jsonb_build_object('dl_dt',to_char(timestamptz '2026-01-01'+(n*30+12)*interval '1 day','YYYYMMDD'),'dl_amt',(100+n)::text,'ec_amt',(100+n)::text,'fee','0','stnd_is_cd','KR'||lpad(g::text,10,'0'))
 from generate_series(1,${size}) g cross join generate_series(1,10) n;
 insert into realized_pnl_events(id,account_id,security_id,provider_event_id,realized_date,quantity,sell_price,buy_amount,sell_amount,fee,tax,currency,source,provider_payload)
 select md5(t.id::text||i)::uuid,md5('a'||i)::uuid,security_id,'KB:SSQM2442:synthetic:'||t.id,(trade_at-interval '2 days')::date,quantity,price,case when type='buy' then price else 0 end,case when type='sell' then price else 0 end,0,0,'KRW','api',
 jsonb_build_object('stnd_is_cd',provider_payload->>'stnd_is_cd','trd_dt',to_char(trade_at-interval '2 days','YYYYMMDD'),'trd_dl_ccd',case when type='buy' then '02' else '01' end)
 from transactions t cross join generate_series(1,2)i;analyze;`);
 const out={before:[],after:[]};let expected;
 for(let i=0;i<(process.env.BENCHMARK?6:2);i++)for(const kind of (i%2?['after','before']:['before','after'])){
  await db.exec('reset role');await db.exec(kind==='before'?base:candidate);await db.exec('set role authenticated');
  const start=performance.now();const r=(await db.query("select public.get_live_period_stock_pnl('1W') r")).rows[0].r;
  if(!expected)expected=r;else assert.deepEqual(r,expected);if(i)out[kind].push(Math.round((performance.now()-start)*10)/10);
 }
 assert.equal(expected.candidate_count,size);assert.ok(expected.items.every(x=>x.verified_date_count>0));
 console.log(JSON.stringify({size,transactions:size*10,evidence:size*20,out,candidates:expected.candidate_count}));await db.exec('reset role');
 if(process.env.PERIOD_BROWSER&&size===100){const {compareBrowser}=await import('./period250_browser_helper.mjs');await compareBrowser(db,base,candidate);}
}
await db.exec("delete from transactions where security_id in(select id from securities where symbol::int>20);delete from realized_pnl_events where security_id in(select id from securities where symbol::int>20);delete from holdings where security_id in(select id from securities where symbol::int>20);delete from securities where symbol::int>20");
const mutations=[
 "update realized_pnl_events set provider_payload=provider_payload||jsonb_build_object('trd_dt','20260101') where id=md5(md5('1:10')::uuid::text||'1')::uuid",
 "insert into realized_pnl_events select md5('duplicate')::uuid,account_id,security_id,provider_event_id||':duplicate',realized_date,quantity,sell_price,buy_price,sell_amount,buy_amount,fee,tax,realized_pnl,return_rate,currency,source,provider_payload,created_at,updated_at from realized_pnl_events where id=md5(md5('2:10')::uuid::text||'1')::uuid",
 "update realized_pnl_events set source='manual' where security_id=md5('s3')::uuid",
 "update realized_pnl_events set currency='USD' where security_id=md5('s4')::uuid",
 "update realized_pnl_events set provider_event_id='OTHER:synthetic' where security_id=md5('s5')::uuid",
 "update transactions set order_at=trade_at-interval '2 days' where security_id=md5('s6')::uuid",
 "update realized_pnl_events set provider_payload=provider_payload||jsonb_build_object('stnd_is_cd',' KR0000000007 ','trd_dl_ccd',' 01 ') where security_id=md5('s7')::uuid and provider_payload->>'trd_dl_ccd'='01'",
 "update realized_pnl_events set provider_payload=provider_payload-'stnd_is_cd' where security_id=md5('s8')::uuid",
 "update transactions set provider_payload=provider_payload||jsonb_build_object('dl_amt','bad') where security_id=md5('s9')::uuid",
 "update transactions set quantity=.5,net_amount=net_amount/2,provider_payload=provider_payload||jsonb_build_object('dl_amt',(price/2)::text,'ec_amt',(price/2)::text) where security_id=md5('s10')::uuid;insert into transactions select md5(id::text||':split')::uuid,account_id,security_id,external_id,trade_at,settlement_at,type,quantity,price,gross_amount,fee,tax,net_amount,currency,fx_rate,realized_pnl,official_realized_pnl,source,provider_revision,provider_payload_hash,provider_payload,created_at,updated_at,order_at,account_reflected_at,fetched_at,raw_type,normalized_type,position_delta from transactions where security_id=md5('s10')::uuid",
 "insert into transactions(id,account_id,security_id,type,trade_at,quantity,currency,source) values(md5('corp')::uuid,md5('a1')::uuid,md5('s11')::uuid,'transfer_in','2026-11-05',1,'KRW','manual')",
 "update transactions set trade_at='2025-01-01' where id=md5('corp')::uuid",
 "update transactions set trade_at='2027-01-01' where id=md5('corp')::uuid",
 "update transactions set trade_at='2026-11-05',type='fee' where id=md5('corp')::uuid",
 "select set_config('request.jwt.claim.sub',md5('u2')::uuid::text,false)",
 "select set_config('request.jwt.claim.sub',md5('nobody')::uuid::text,false)"
];
for(const [i,sql] of mutations.entries()){
 await db.exec('reset role');await db.exec(sql);
 for(const period of ['오늘','1W','1M','3M','6M','1Y','ALL']){
  await db.exec(base);await db.exec('set role authenticated');const before=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  await db.exec('reset role');await db.exec(candidate);await db.exec('set role authenticated');const after=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  assert.deepEqual(after,before,`evidence mutation ${i}/${period}`);
  if(i===1&&period==='ALL')assert.ok(after.items.find(x=>x.symbol==='000002').provisional_date_count>0,'ambiguous match stays provisional');
  if(i===9&&period==='ALL')assert.ok(after.items.some(x=>x.grouped_date_count>0),'aggregate evidence recovers split ledger rows');
  if(i===mutations.length-1)assert.equal(after.ok,false,'no account cannot read another owner');
  await db.exec('reset role');
 }
}
console.log('Corporate candidate experiment: exact full JSON equality across seven periods, grouped/ambiguous evidence and two users plus no-account role');
await db.close();
