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
await db.exec(`create table public.kb_balance_position_evidence(id uuid,account_id uuid,symbol text,observed_at timestamptz,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,source text);grant select on public.kb_balance_position_evidence to authenticated;`);
await db.exec(fs.readFileSync('supabase/build251_domestic_opening.sql','utf8'));
const original=await getDefinition();
const migration=fs.readFileSync('tests/fixtures/period_corporate_candidate_experiment.sql','utf8').replace('a1c5b0dd24c00467912fc425ce351892','b08fe9c5e0bab487b0dc1a64aad25800');
await db.exec(migration);
const changed=await getDefinition();
const base=original.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const candidate=changed.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");


// Synthetic mixed corporate/IPO/alias history; no production connection or writes.
const size=Number(process.env.COHORT_SIZE||100);
await db.exec(`
insert into securities(id,symbol,name,currency,isin)
select md5('s'||g)::uuid,lpad(g::text,6,'0'),'Synthetic mixed '||g,'KRW','KR'||lpad(g::text,10,'0') from generate_series(1,${size})g;
insert into securities(id,symbol,name,currency,isin)
select md5('alias'||g)::uuid,'A'||lpad(g::text,6,'0'),'Synthetic alias '||g,'KRW','KR'||lpad(g::text,10,'0') from generate_series(1,${size})g where g%4=0;
insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base)
select md5('h'||g)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,'2026-11-09T03:00:00Z',0,0,'KRW',1 from generate_series(1,${size})g;
insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
select md5(g||tag)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,typ,dt::timestamptz,dt::timestamptz,qty,100,amt,0,0,'KRW','api',
jsonb_build_object('smry_nm',summary,'dl_amt',gross,'ec_amt',case when g%5=0 and tag='pay' then '499' else cash end,'fee','0','stnd_is_cd','KR'||lpad(g::text,10,'0'))
from generate_series(1,${size})g cross join (values ('pay','other','2026-11-03',10,-500,'공모불입 출금','500','500'),('refund','other','2026-11-04',2,300,'공모주환불금 입금','300','300'),('receipt','transfer_in','2026-11-05',2,0,'공모주 입고','','0'),('sale','sell','2026-11-06',2,200,'매도','200','200'))v(tag,typ,dt,qty,amt,summary,gross,cash);
insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
select md5(g||':'||n)::uuid,md5('a1')::uuid,case when g%4=0 then md5('alias'||g)::uuid else md5('s'||g)::uuid end,
case when n%2=1 then 'buy' else 'sell' end,timestamptz '2026-01-01'+n*interval '12 days',timestamptz '2026-01-01'+n*interval '12 days',1,100,case when n%2=1 then -100 else 100 end,0,0,'KRW','api',
jsonb_build_object('dl_amt','100','ec_amt','100','fee','0','stnd_is_cd','KR'||lpad(g::text,10,'0')) from generate_series(1,${size})g cross join generate_series(1,24)n where g%2=0;
insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,currency,source)
select md5('corp'||g||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,'transfer_in',dt,dt,1,'KRW','manual' from generate_series(1,${size})g cross join (values(1,timestamptz '2026-10-01'),(2,timestamptz '2026-11-05'),(3,timestamptz '2027-01-01'))v(n,dt) where g%3=0;
analyze;`);
const inspect=d=>{const body=d.split('$function$')[1];return body.slice(0,body.indexOf('), calculated as'))+') select (select count(*) from verified_ipo) ipo_count, (select count(*) from evidence where corporate_event) corporate_count';};
await db.exec('set role authenticated');
const flags=(await db.query(inspect(candidate).replaceAll('p_period',"'ALL'"))).rows[0];
assert.ok(Number(flags.ipo_count)>0);assert.ok(Number(flags.corporate_count)>0);
await db.exec('reset role');
const samples=[];
for(const period of ['오늘','1W','1M','3M','6M','1Y','ALL']){
 let expected;
 for(let run=0;run<6;run++)for(const kind of run%2?['after','before']:['before','after']){
  await db.exec(kind==='before'?base:candidate);await db.exec('set role authenticated');const start=performance.now();
  const result=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
  const ms=performance.now()-start;if(!expected)expected=result;else assert.deepEqual(result,expected,period);
  if(run)samples.push({period,kind,ms});await db.exec('reset role');
 }
}
console.log(JSON.stringify({size,flags,transactions:(await db.query('select count(*) n from transactions')).rows[0].n,samples}));
if(process.env.PERIOD_BROWSER){const {compareBrowser}=await import('./period250_browser_helper.mjs');await compareBrowser(db,base,candidate,{transactions:Number((await db.query('select count(*) n from transactions')).rows[0].n),positions:size,cohort:'mixed IPO/corporate/alias on Build251'});}
await db.close();
