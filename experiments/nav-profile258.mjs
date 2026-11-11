// Follow-up attribution. Actual NAV/scope/flow functions; synthetic data only.
import {createRealizedFixture} from '../tests/fixtures/realized257.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const freeze=s=>s.replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'");
const rows=[];
for(const size of [10,100]){
 const db=await createRealizedFixture(size);
 const helpers=readFileSync('supabase/build254_nav_contract.sql','utf8');
 await db.exec(helpers.slice(0,helpers.indexOf('create or replace function public.get_live_nav_reconciliation')));
 await db.exec(freeze(readFileSync('tests/fixtures/nav258.sql','utf8')));
 await db.exec(freeze(readFileSync('supabase/build258_empty_period_items.sql','utf8')));
 await db.exec(freeze(readFileSync('supabase/build257_realized_accumulation.sql','utf8')));
 await db.exec(`create unique index snapshot_account_day on daily_account_snapshots(account_id,snapshot_date);
 create index scope_latest on daily_account_snapshots(snapshot_at desc);
 create index sync_lookup on sync_logs(account_id,scope,status,started_at,id desc);
 alter table cash_flows add primary key(id);
 create index flow_account_date on cash_flows(account_id,occurred_at);
 create index manual_account_date on manual_adjustments(account_id,occurred_on);
 create index daily_evidence_account_date on daily_performance_evidence(account_id,end_date);
 insert into daily_account_snapshots(id,account_id,snapshot_date,snapshot_at,total_assets,cash,securities_value,unrealized_pnl)
 select md5('snap'||g)::uuid,md5('a1')::uuid,date '2025-11-08'+g,timestamptz '2025-11-08 12:00+09'+g*interval '1 day',1000000,100000,900000,0 from generate_series(0,366) g;
 insert into sync_logs(id,account_id,scope,status,started_at,detail)
 select md5('log'||g)::uuid,md5('a1')::uuid,'kb_current_snapshot','success',timestamptz '2025-11-08 12:00+09'+g*interval '1 day','{"manual_overlay_assets":0}'::jsonb from generate_series(0,366) g;
 grant select on all tables in schema public to authenticated;analyze;`);
 for(const flows of [0,30,300]){
  await db.exec(`reset role;delete from cash_flows;insert into cash_flows(id,account_id,occurred_at,amount,currency,fx_rate_to_base,source,updated_at)
  select md5('flow'||g)::uuid,md5('a1')::uuid,timestamptz '2026-01-01 09:00+09'+g*interval '1 day',case when g%2=0 then 200000 else -200000 end,'KRW',1,'api',timestamptz '2026-11-09' from generate_series(1,${flows}) g;analyze;set role authenticated;`);
  for(const period of ['1W','1M','3M','ALL']){
   const expected=(await db.query('select get_live_realized_sales($1) r',[period])).rows[0].r;
   const stock=(await db.query('select get_live_period_stock_pnl($1) r',[period])).rows[0].r;
   const nav=(await db.query('select get_live_nav_reconciliation($1) r',[period])).rows[0].r;
   assert.deepEqual(stock.reconciliation,nav);assert.equal(nav.whole_pnl,null);assert.equal(nav.whole_pnl_verified,false);
   for(let run=0;run<5;run++){
    const sample={size,transactions:size*30,flows,period,run};
    for(const [label,fn] of (run%2?[['realized','get_live_realized_sales'],['stock','get_live_period_stock_pnl'],['nav','get_live_nav_reconciliation']]:[['nav','get_live_nav_reconciliation'],['stock','get_live_period_stock_pnl'],['realized','get_live_realized_sales']])){
     const start=performance.now(),r=(await db.query('select '+fn+'($1) r',[period])).rows[0].r;
     sample[label+'Ms']=performance.now()-start;assert.deepEqual(r,{realized:expected,stock,nav}[label]);
    }
    rows.push(sample);
   }
   console.error(JSON.stringify({size,flows,period,latest:rows.at(-1)}));
  }
 }
 await db.close();
}
writeFileSync('performance/nav-profile258.json',JSON.stringify({conditions:'PGlite; actual current NAV, account scope, flow allocation and date classifier; 367 daily snapshots and sync logs; all synthetic; representative lookup indexes; 0/30/300 synthetic KRW flows; plans warm; no network or browser. Nested durations overlap: do not sum. Not production latency.',rows},null,2)+'\n');
