import {createRealizedFixture} from './fixtures/realized257.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=await createRealizedFixture(1),freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')).replace('public.get_live_realized_sales(','public.original_realized_sales('));
await db.exec(freeze(readFileSync('supabase/build259_daily_realized_records.sql','utf8')));
await db.exec("update securities set currency='KRW',isin='KR0000000001';delete from transactions");
let n=0,checks=0;
async function insert(table,r){let keys=Object.keys(r);await db.query(`insert into ${table} (${keys}) values (${keys.map((_,i)=>'$'+(i+1))})`,Object.values(r));}
const id=label=>'00000000-0000-0000-0000-'+String(label).padStart(12,'0');
const ids=(await db.query('select id from accounts')).rows[0];const sid=(await db.query('select id from securities')).rows[0].id;
async function trade(type,day,qty,price){const r={id:id(++n),account_id:ids.id,security_id:sid,type,trade_at:day+'T00:00:00+09:00',quantity:qty,price,net_amount:(type==='buy'?-1:1)*qty*price,fee:0,tax:0,currency:'KRW',source:'api',provider_payload:{dl_dt:day.replaceAll('-',''),stnd_is_cd:'KR0000000001',dl_amt:String(qty*price)}};await insert('transactions',r);return r;}
async function evidence(t,day,extra={}){await insert('realized_pnl_events',{id:id(++n),account_id:ids.id,security_id:sid,provider_event_id:'KB:SSQM2442:synthetic:'+n,source:'api',currency:'KRW',quantity:t.quantity,sell_price:t.price,buy_amount:t.type==='buy'?t.quantity*t.price:0,sell_amount:t.type==='sell'?t.quantity*t.price:0,realized_date:day,provider_payload:{stnd_is_cd:'KR0000000001',trd_dt:day.replaceAll('-',''),trd_dl_ccd:t.type==='buy'?'02':'01'},...extra});}
async function compare(){for(const period of ['1W','1M','3M','ALL']){const a=(await db.query('select original_realized_sales($1) r',[period])).rows[0].r,b=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;assert.deepEqual(b,a);checks++;}return (await db.query("select get_live_realized_sales('ALL') r")).rows[0].r;}
let b=await trade('buy','2026-11-05',2,100),s=await trade('sell','2026-11-05',1,120);
await evidence(b,'2026-11-01');await evidence(s,'2026-11-04');
let r=await compare();assert.equal(r.items[0].realized_local,20);assert.equal(r.items[0].trade_date,'2026-11-04');
await db.exec('delete from transactions;delete from realized_pnl_events');
b=await trade('buy','2026-11-05',1,90);await trade('buy','2026-11-05',1,110);await evidence(b,'2026-11-01',{quantity:2,sell_price:100,buy_amount:200});s=await trade('sell','2026-11-06',1,120);await evidence(s,'2026-11-04');
r=await compare();assert.equal(r.items[0].realized_local,20);
await db.exec("update realized_pnl_events set realized_date='2026-11-04',provider_payload=jsonb_set(provider_payload,'{trd_dt}','\"20261104\"')");
r=await compare();assert.equal(r.items[0].realized_local,null);assert.equal(r.items[0].status,'order_unverified');
await db.exec("update realized_pnl_events set sell_amount=999 where provider_payload->>'trd_dl_ccd'='01'");await compare();
await db.close();console.log('Build259 recovered-date, grouped-fill, mixed-day and invalid-source full comparisons:',checks);
