export function batchReconciliationCandidate(sql){
 const timeline=/  select jsonb_build_object\('settled',b\.settled_quantity[\s\S]*?order by b\.observed_at desc limit 1;/;
 const service=/    select b\.\* into v_balance from public\.kb_balance_position_evidence b[\s\S]*?order by b\.observed_at desc limit 1;/;
 if(!timeline.test(sql)||!service.test(sql))throw new Error('reconciliation source drift');
 return sql.replace(timeline,`  select public.batch_balance_273(c.account_id::text,c.symbol,c.currency,
    (select max(d.snapshot_at) from public.daily_account_snapshots d where d.account_id=c.account_id)) into v_balance;`)
 .replace(service,`    select b.symbol,b.settled settled_quantity,b.effective effective_quantity,
      b.pending_buy pending_buy_quantity,b.pending_sell pending_sell_quantity into v_balance
      from jsonb_to_record(public.batch_balance_273(v_account::text,v_item->>'symbol',v_currency,
        (v_report->>'balance_at')::timestamptz))
      as b(symbol text,settled numeric,effective numeric,pending_buy numeric,pending_sell numeric);`);
}
