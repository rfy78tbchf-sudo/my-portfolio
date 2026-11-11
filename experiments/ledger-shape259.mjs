// Equal transaction count, different per-security history lengths. Synthetic local SQL only.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const rows=[];
for(const securities of [100,10,1]){
 const count=3000/securities,db=await createRealizedFixture(securities);
 await db.exec(freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')));
 await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
 await db.exec(`delete from transactions;delete from fx_rates;
 insert into fx_rates(id,rate_date,base_currency,quote_currency,rate,source) select md5('fx'||n)::uuid,date '2026-11-09'-n,'USD','KRW',1400,'synthetic' from generate_series(0,3001) n;
 insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',jsonb_build_object('dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0')) from generate_series(1,${securities}) g cross join generate_series(1,${count}) n;analyze;set role authenticated;`);
 const expected=(await db.query("select get_live_realized_sales('ALL') r")).rows[0].r;
 assert.equal(expected.items.length,1500);assert.equal(expected.items.reduce((n,x)=>n+Number(x.realized_local),0),15000);
 for(let run=0;run<5;run++){
  const start=performance.now(),r=(await db.query("select get_live_realized_sales('ALL') r")).rows[0].r;
  assert.deepEqual(r,expected);rows.push({securities,transactions:3000,historyPerSecurity:count,run,ms:performance.now()-start});
 }
 console.error(securities,rows.slice(-5).map(x=>Math.round(x.ms)));await db.close();
}
writeFileSync('performance/ledger-shape259.json',JSON.stringify({conditions:'Current stock258 and realized257 SQL; PGlite; 3000 synthetic transactions,1500 sales in each shape; 100/10/1 securities with30/300/3000 daily transactions each; ALL, fixed2026-11-09; five warm repeated queries per shape; NAV stubbed, no network/browser; complete results repeat and independent local profit=15000 USD. Shape changes dates: not a before/after optimization comparison.',rows},null,2)+'\n');
