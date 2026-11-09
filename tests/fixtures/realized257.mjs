import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
// Isolated synthetic database only. NAV is explicitly stubbed.
export async function createRealizedFixture(size){
 const db=new PGlite();
 await db.exec(readFileSync('tests/fixtures/pnl_schema.sql','utf8')+readFileSync('tests/fixtures/period_schema.sql','utf8'));
 await db.exec(`create table public.kb_balance_position_evidence(id uuid,account_id uuid,symbol text,observed_at timestamptz,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,source text);
 create schema auth;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant select on all tables in schema public to authenticated;
 alter table accounts enable row level security;create policy own on accounts to authenticated using(user_id=(select auth.uid()));
 insert into accounts(id,user_id,provider,mode,is_active,created_at) values(md5('a1')::uuid,md5('u1')::uuid,'kb_securities','live',true,'2020-01-01');
 select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);`);
 const nav=readFileSync('supabase/build254_nav_contract.sql','utf8');
 await db.exec(nav.slice(0,nav.indexOf('-- This is an arithmetic assertion')));
 // Isolate unchanged stock calculation. NAV subcall intentionally excluded.
 await db.exec(`create function public.get_live_nav_reconciliation(text) returns jsonb language sql stable as $$select '{"diagnostic_stub":true}'::jsonb$$;`);
 const source=readFileSync(process.env.STOCK_SQL_SOURCE||'supabase/build254_existing_periods.sql','utf8');
 await db.exec(source.slice(source.indexOf('CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl')).replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));

 await db.exec(`insert into securities(id,symbol,name,currency,isin) select md5('s'||g)::uuid,'SYNTH'||g,'Synthetic '||g,'USD','US'||lpad(g::text,10,'0') from generate_series(1,${size}) g;
 insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) values(md5('h')::uuid,md5('a1')::uuid,md5('s1')::uuid,'2026-11-09T03:00:00Z',0,0,'USD',1400);
 insert into transactions(id,account_id,security_id,type,trade_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-01-01'+(n*10+11)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',
 jsonb_build_object('dl_dt',to_char(timestamptz '2026-01-01'+(n*10+11)*interval '1 day','YYYYMMDD'),'dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0'))
 from generate_series(1,${size}) g cross join generate_series(1,30) n;analyze;`);

 await db.exec(`create table account_observations(id uuid,account_id uuid,source text);
 create table position_observations(id uuid,account_id uuid,account_observation_id uuid,security_id uuid,fetched_at timestamptz,quantity numeric,avg_cost numeric,market_price numeric,market_value numeric,currency text,fx_rate_to_base numeric);
 alter table transactions add primary key(id);
 alter table securities add primary key(id);
 alter table accounts add primary key(id);
 alter table fx_rates add primary key(id);
 alter table kb_position_evidence add primary key(id);
 alter table realized_pnl_events add primary key(id);
 alter table position_observations add primary key(id);
 alter table account_observations add primary key(id);
 create index tx_account_date on transactions(account_id,trade_at desc);
 create index tx_security on transactions(security_id);
 create index tx_effective on transactions(account_id,security_id,((coalesce(order_at,trade_at) at time zone 'Asia/Seoul')::date));
 create index tx_isin on transactions(account_id,(provider_payload->>'stnd_is_cd'),trade_at) where type in ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out');
 create index tx_settlement on transactions(account_id,trim(provider_payload->>'stnd_is_cd'),((trade_at at time zone 'Asia/Seoul')::date),quantity,price) where type='sell';
 create index evidence_asset on kb_position_evidence(account_id,asset_key,order_date);
 create index realized_account_date on realized_pnl_events(account_id,realized_date desc);
 create index observations_lookup on position_observations(account_id,security_id,fetched_at);
 create index fx_day on fx_rates(rate_date,base_currency,quote_currency,source);
 insert into fx_rates(id,rate_date,base_currency,quote_currency,rate,source)
 select md5('fx'||g)::uuid,date '2026-01-01'+g,'USD','KRW',1400,'synthetic' from generate_series(0,312) g;
 grant select on all tables in schema public to authenticated;analyze;`);
 return db;
}
