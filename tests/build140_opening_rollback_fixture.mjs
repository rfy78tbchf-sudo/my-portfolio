import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build140_period_opening.sql','utf8');
const checks=sql.slice(sql.indexOf('opening_boundary_checks as materialized ('),sql.indexOf('), evidence as ('))+')';
const gate=sql.slice(sql.indexOf(' cross join lateral(select coalesce(snap.quantity'),sql.indexOf('), classified as ('));
const cases=['valid','wrong_quantity','stale_snapshot','wrong_day','day_trade','unknown_date','corporate','domestic','duplicate','stale_price','missing_price','zero_price','rollback','wrong_rollback','snapshot_day_trade'];
const p=[],h=[],d=[],t=[],tx=[],q=[];
for(const key of cases){
 p.push({asset_key:key,currency:key==='domestic'?'KRW':'USD',start_qty:5,provisional_count:key==='unknown_date'?1:0,start_date:'2026-10-01',cutoff:'2026-10-04T12:00:00Z'});
 h.push({account_id:'a',security_id:key,snapshot_date:key==='wrong_day'?'2026-10-02':'2026-10-01',currency:key==='domestic'?'KRW':'USD',quantity:key==='wrong_quantity'?4:5,market_value:500,updated_at:key==='stale_snapshot'?'2026-10-01T00:00:00Z':'2026-10-01T12:00:00Z'});
 if(key==='duplicate')h.push({...h.at(-1)});
 if(key==='day_trade')t.push({asset_key:key,day:'2026-10-01',type:'buy',quantity:1});
 if(['rollback','wrong_rollback','snapshot_day_trade'].includes(key)){h.at(-1).snapshot_date='2026-10-02';h.at(-1).updated_at='2026-10-02T12:00:00Z';h.at(-1).quantity=key==='wrong_rollback'?7:8;t.push({asset_key:key,day:'2026-10-01',type:'buy',quantity:3});if(key==='snapshot_day_trade')t.push({asset_key:key,day:'2026-10-02',type:'buy',quantity:1});}
 if(key==='corporate')tx.push({security_id:key,type:'split_in',effective_at:'2026-10-01T00:00:00Z',trade_at:'2026-10-01T00:00:00Z'});
 q.push({asset_key:key,price_date:key==='stale_price'?'2026-09-29':'2026-09-30',close:key==='missing_price'?null:key==='zero_price'?0:100});
}
d.push({account_id:'a',snapshot_date:'2026-10-01',snapshot_at:'2026-10-01T12:00:00Z'});
d.push({account_id:'a',snapshot_date:'2026-10-02',snapshot_at:'2026-10-02T12:00:00Z'});
const rec=(name,rows,fields)=>`${name} as(select * from jsonb_to_recordset('${JSON.stringify(rows)}'::jsonb) x(${fields}))`;
const input=["account as(select 'a'::text id)",rec('positions',p,'asset_key text,currency text,start_qty numeric,provisional_count int,start_date date,cutoff timestamptz'),rec('snapshots',h,'account_id text,security_id text,snapshot_date date,currency text,quantity numeric,market_value numeric,updated_at timestamptz'),rec('account_snapshots',d,'account_id text,snapshot_date date,snapshot_at timestamptz'),rec('period_trades',t,'asset_key text,day date,type text,quantity numeric'),rec('dated_transactions',tx,'security_id text,type text,effective_at timestamptz,trade_at timestamptz'),rec('prices',q,'asset_key text,price_date date,close numeric'), 'keys as(select asset_key id,asset_key from positions)'];
console.log('with '+input.join(',')+','+checks.replaceAll('public.daily_security_snapshots','snapshots').replaceAll('public.daily_account_snapshots','account_snapshots').replaceAll('p_period',"'THIS_MONTH'")+", checked as(select p.asset_key,boundary.valid from positions p join prices q using(asset_key) cross join (select 7::numeric quantity) snap "+gate+") select count(*) cases,count(*) filter(where valid<>(asset_key in ('valid','rollback'))) failures from checked;");
