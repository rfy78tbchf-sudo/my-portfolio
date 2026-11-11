import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8')+fs.readFileSync('tests/fixtures/period_schema.sql','utf8'));
await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
insert into accounts(id,user_id,provider,mode,is_active,created_at) values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','kb_securities','live',true,'2020-01-01');`);
const original=fs.readFileSync('tests/fixtures/period248.sql','utf8').split('\n').slice(1).join('\n');
await db.exec(original);
const migration=fs.readFileSync('supabase/build249_period_evidence.sql','utf8');
await db.exec(migration);await db.exec(migration); // Idempotence, preserving function identity/ACLs.
const deployed=(await db.query("select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) d")).rows[0].d;
assert.equal(deployed.trim(),original.replace('), evidence as (','), evidence as materialized (').replace(`(select count(*) from domestic_period_membership pm join dated_transactions dt on dt.id=pm.transaction_id join keys dk on dk.id=dt.security_id where dk.asset_key=calculated.asset_key and dt.effective_at is null)`,`case when p_period='ALL' then 0 else (select count(*) from domestic_period_membership pm join dated_transactions dt on dt.id=pm.transaction_id join keys dk on dk.id=dt.security_id where dk.asset_key=calculated.asset_key and dt.effective_at is null) end`).trim());
const base=original.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const candidate=deployed.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
for(const size of (process.env.BENCHMARK ? [20,100,200] : [20,100])){
 await db.exec(`truncate transactions,holdings,securities;
 insert into securities(id,symbol,name,currency,isin) select md5('security'||g)::uuid,'SYNTH'||g,'Synthetic '||g,'USD','US'||lpad(g::text,10,'0') from generate_series(1,${size}) g;
 insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) values(md5('holding')::uuid,'00000000-0000-0000-0000-000000000002',md5('security1')::uuid,'2026-11-09T00:00:00Z',0,0,'USD',1400);
 insert into transactions(id,account_id,security_id,type,trade_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,'00000000-0000-0000-0000-000000000002',md5('security'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-01-01'+(n*10+11)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',
 jsonb_build_object('dl_dt',to_char(timestamptz '2026-01-01'+(n*10+11)*interval '1 day','YYYYMMDD'),'dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0'))
 from generate_series(1,${size}) g cross join generate_series(1,30) n; analyze;`);
 const samples={before:[],after:[]};let expected;
 for(let run=0;run<(process.env.BENCHMARK?6:2);run++)for(const kind of (run%2?['after','before']:['before','after'])){
  await db.exec(kind==='before'?base:candidate);
  const t=performance.now();const result=(await db.query("select public.get_live_period_stock_pnl('ALL') r")).rows[0].r;
  const ms=performance.now()-t;
  if(!expected)expected=result;else assert.deepEqual(result,expected);
  if(run>0)samples[kind].push(Math.round(ms*10)/10);
 }
 for(const period of ['오늘','1W','1M','3M','6M','1Y','ALL']){
  await db.exec(base);const before=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  await db.exec(candidate);const after=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  assert.deepEqual(after,before,`full function equality ${size}/${period}`);
 }
 console.log(JSON.stringify({size,transactions:size*30,candidates:expected.candidate_count,included:expected.included_count,samples}));
 if(process.env.PERIOD_BROWSER&&size===100){const {compareBrowser}=await import('./period249_browser_helper.mjs');await compareBrowser(db,base,candidate);}
}
// Correctness variants need 20 positions; scaling was measured separately above.
await db.exec("delete from transactions where security_id in(select id from securities where replace(symbol,'SYNTH','')::int>20); delete from securities where replace(symbol,'SYNTH','')::int>20");
// Perturb evidence, dates, aliases, snapshots, currencies, missing amounts and ownership.
const mutations=[
 "update transactions set order_at=trade_at where security_id=md5('security1')::uuid",
 "update transactions set type='transfer_in' where id=md5('2:1')::uuid",
 "update transactions set net_amount=null where id=md5('3:2')::uuid",
 "update transactions set quantity=2 where id=md5('4:2')::uuid",
 "update transactions set trade_at='2027-01-01' where id=md5('5:30')::uuid",
 "update securities set isin=(select isin from securities where id=md5('security6')::uuid) where id=md5('security7')::uuid",
 "update securities set isin=null where id=md5('security8')::uuid",
 "update transactions set order_at=trade_at; update holdings set quantity=2,market_value=240,fx_rate_to_base=null",
 "insert into daily_security_prices(security_id,price_date,close,currency) select id,'2026-11-02',100,'USD' from securities",
 "insert into fx_rates(rate_date,base_currency,quote_currency,rate,source) select d,'USD','KRW',1400,'synthetic' from generate_series(date '2025-01-01',date '2026-11-09',interval '1 day') d",
 "insert into daily_account_snapshots(account_id,snapshot_date,snapshot_at) values('00000000-0000-0000-0000-000000000002','2026-11-02','2026-11-02T10:00:00Z'); insert into daily_security_snapshots(account_id,security_id,snapshot_date,quantity,market_value,currency,fx_rate_to_base,updated_at) values('00000000-0000-0000-0000-000000000002',md5('security1')::uuid,'2026-11-02',2,210,'USD',1400,'2026-11-02T10:00:00Z')",
 "update transactions set currency='KRW',provider_payload=provider_payload||jsonb_build_object('ec_amt',abs(net_amount)::text,'fee','0') where security_id=md5('security9')::uuid; update securities set currency='KRW',symbol='000009' where id=md5('security9')::uuid",
 "update transactions set account_id='00000000-0000-0000-0000-000000000099' where security_id=md5('security10')::uuid",
 "update accounts set is_active=false"
];
for(const [i,sql] of mutations.entries()){
 await db.exec(sql);
 for(const period of ['1W','1M','3M','ALL']){
  await db.exec(base);const before=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  await db.exec(candidate);const after=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  assert.deepEqual(after,before,`evidence mutation ${i}/${period}`);
 }
}
console.log('Full function equality: periods, history sizes and 14 evidence/ownership mutations passed');
await db.close();
