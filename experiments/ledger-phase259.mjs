// Equal transaction count, different per-security history lengths. Synthetic local SQL only.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const rows=[];
for(const securities of [100,1]){
 const count=3000/securities,db=await createRealizedFixture(securities);
 await db.exec(freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')));
 await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
 await db.exec(`delete from transactions;delete from fx_rates;
 insert into fx_rates(id,rate_date,base_currency,quote_currency,rate,source) select md5('fx'||n)::uuid,date '2026-11-09'-n,'USD','KRW',1400,'synthetic' from generate_series(0,3001) n;
 insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',jsonb_build_object('dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0')) from generate_series(1,${securities}) g cross join generate_series(1,${count}) n;analyze;set role authenticated;`);
 const raw=freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8'));
 await db.exec('reset role');
 let profile=raw.replace('public.get_live_realized_sales(','public.diagnostic_realized_sales(').replace('declare\n',"declare\n  diagnostic_at timestamptz := clock_timestamp(); diagnostic_stock_at timestamptz; diagnostic_phases jsonb := '{}';\n");
 const boundaries=[
 ['  -- BEGIN recovered-date projection','account'],
 ['  for v_security in','dates'],
 ['  -- Execution evidence is visible','ledger'],
 ['  -- Prefer an independently reconciled','pending'],
 ['  -- Aggregate fully closed periods','official'],
 ['  -- Build245','closed']
 ];
 // Final two anchors resolved from current SQL rather than assuming comment spelling.
 boundaries.pop();
 const estimateAt=profile.indexOf('  with candidates as');
 if(estimateAt<0)throw Error('estimate anchor drift');
 boundaries.push([profile.slice(estimateAt,estimateAt+21),'closed']);
 for(const [anchor,label] of boundaries){if(!profile.includes(anchor))throw Error('phase anchor drift '+label);profile=profile.replace(anchor,`  diagnostic_phases:=diagnostic_phases||jsonb_build_object('${label}',extract(epoch from clock_timestamp()-diagnostic_at)*1000);diagnostic_at:=clock_timestamp();\n`+anchor)}
 profile=profile.replace("  return jsonb_build_object('ok',true",`  diagnostic_phases:=diagnostic_phases||jsonb_build_object('estimates',extract(epoch from clock_timestamp()-diagnostic_at)*1000);\n  return jsonb_build_object('_diagnostic_ms',diagnostic_phases,'ok',true`);
 const stockLine="    v_period:=public.get_live_period_stock_pnl(case when p_period='TODAY' then '오늘' else p_period end);";
 assert.ok(profile.includes(stockLine));
 profile=profile.replace(stockLine,"    diagnostic_stock_at:=clock_timestamp();\n"+stockLine+"\n    diagnostic_phases:=diagnostic_phases||jsonb_build_object('stock_subcall',extract(epoch from clock_timestamp()-diagnostic_stock_at)*1000);");

 await db.exec(profile);await db.exec('set role authenticated');
 for(const period of ['1W','1M','3M','ALL']){
 const expected=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;
 await db.query('select diagnostic_realized_sales($1)',[period]);
 for(let run=0;run<5;run++){
 const start=performance.now(),r=(await db.query('select diagnostic_realized_sales($1) r',[period])).rows[0].r;
 const ms=performance.now()-start,phases=r._diagnostic_ms;delete r._diagnostic_ms;
 assert.deepEqual(r,expected);rows.push({securities,transactions:3000,historyPerSecurity:count,period,run,ms,phases});
 }
 console.error(securities,period,rows.slice(-5).map(x=>Math.round(x.ms)));
 }
 console.error(securities,rows.slice(-5).map(x=>Math.round(x.ms)));await db.close();
}
writeFileSync('performance/ledger-phase259.json',JSON.stringify({conditions:'Current stock258 and realized257 SQL; PGlite; 3000 synthetic transactions,1500 sales in each shape; 100/1 securities with30/3000 daily transactions each; 1W/1M/3M/ALL, phase attribution (nested stock is included in closed phase), fixed2026-11-09; five warm repeated queries per shape; NAV stubbed, no network/browser; instrumentation-stripped complete responses equal uninstrumented current SQL. Shape changes dates: not a before/after optimization comparison.',rows},null,2)+'\n');
