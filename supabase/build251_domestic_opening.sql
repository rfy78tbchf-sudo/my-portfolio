-- Reconcile a domestic opening boundary only when verified unsettled trades
-- explain the entire prior snapshot discrepancy and a later snapshot agrees.
-- Also reconcile a USD opening from archived native balance components, with
-- pre-period pending executions matched separately on both sides after US close.
-- No financial rows, cost bases or security policies change.
do $patch$
declare d text;
begin
 select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into d;
 if md5(btrim(d,E' \n\r\t'))='b08fe9c5e0bab487b0dc1a64aad25800' then return; end if;
 if md5(btrim(d,E' \n\r\t'))<>'a1c5b0dd24c00467912fc425ce351892' then raise exception 'Build251 period definition drift'; end if;
 d:=replace(d,$old$), opening_boundary_checks as materialized ($old$,$new$), domestic_opening_settlement_checks as materialized (
 select p.asset_key,max(t.ledger_day) settled_through
 from positions p join ledger t on t.asset_key=p.asset_key
 and t.day<p.start_date and t.ledger_day>=p.start_date
 join lateral (
 select sum(h.quantity) quantity
 from public.daily_security_snapshots h join account a on a.id=h.account_id
 join keys k on k.id=h.security_id and k.asset_key=p.asset_key
 join public.daily_account_snapshots d on d.account_id=h.account_id and d.snapshot_date=h.snapshot_date
 where h.snapshot_date=p.start_date-1 and h.currency='KRW'
 having count(*)>0 and bool_and(h.updated_at=d.snapshot_at and h.quantity>0 and h.market_value>0 and h.fx_rate_to_base=1)
 ) snap on true
 where p.currency='KRW' and p_period<>'오늘' and p.start_qty>0
 group by p.asset_key,p.start_qty,snap.quantity
 having bool_and(t.currency='KRW' and not t.provisional_date and t.cash_verified
 and t.quantity>0 and t.price>0 and (t.recovered_date is not null or t.group_date_recovered))
 and sum(case when t.type='buy' then t.quantity else -t.quantity end)=p.start_qty-snap.quantity
 and p.start_qty<>snap.quantity
), native_opening_balance_checks as materialized (
 select distinct p.asset_key
 from positions p join public.kb_balance_position_evidence h on h.symbol=p.symbol
 join account a on a.id=h.account_id
 join lateral (
 select coalesce(sum(e.quantity) filter(where e.event_type='buy'),0) buys,
 coalesce(sum(e.quantity) filter(where e.event_type='sell'),0) sells
 from public.kb_position_evidence e join account a on a.id=e.account_id
 where e.asset_key=p.asset_key and e.symbol=p.symbol and e.source='SPQM2205' and e.active
 and e.order_date<p.start_date and e.settlement_date>(h.observed_at at time zone 'Asia/Seoul')::date
 having count(*)>0 and bool_and(coalesce(e.currency='USD' and e.event_type in ('buy','sell')
 and e.quantity>0 and e.price>0 and e.evidence->>'occurrences'='1',false))
 and count(*)=count(distinct e.source_key)
 ) pending on true
 where p.currency='USD' and p.asset_key ~ '^US[A-Z0-9]{10}$'
 and p_period not in ('오늘','ALL') and p.start_qty>0 and p.provisional_count=0
 and h.source='SSQM2952' and h.effective_quantity=p.start_qty
 and h.settled_quantity>=0 and h.pending_buy_quantity>=0 and h.pending_sell_quantity>=0
 and h.effective_quantity=h.settled_quantity+h.pending_buy_quantity-h.pending_sell_quantity
 and h.pending_buy_quantity=pending.buys and h.pending_sell_quantity=pending.sells
 and (h.observed_at at time zone 'Asia/Seoul')::date=p.start_date and h.observed_at<=p.cutoff
 -- NY zone handles DST. Exclude observations before the prior extended session
 -- ends, and after the next premarket starts. Component equality rejects an
 -- overnight execution that has already entered the observed pending balance.
 and h.observed_at>=((p.start_date-1)+time '20:00') at time zone 'America/New_York'
 and h.observed_at<(p.start_date+time '04:00') at time zone 'America/New_York'
 and not exists(select 1 from dated_transactions t join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date between p.start_date-1 and p.start_date)
), opening_boundary_checks as materialized ($new$);
 d:=replace(d,$old$where p.currency='USD' and p_period<>'오늘' and p.start_qty>0 and p.provisional_count=0$old$,$new$where (p.currency='USD' or (p.currency='KRW' and exists (
 select 1 from domestic_opening_settlement_checks dc where dc.asset_key=p.asset_key and dc.settled_through<=h.snapshot_date
 ))) and p_period<>'오늘' and p.start_qty>0 and p.provisional_count=0$new$);
 d:=replace(d,$old$and exists(select 1 from opening_boundary_checks bc where bc.asset_key=p.asset_key),false) valid$old$,
 $new$and (exists(select 1 from opening_boundary_checks bc where bc.asset_key=p.asset_key)
 or exists(select 1 from native_opening_balance_checks nb where nb.asset_key=p.asset_key)),false) valid$new$);
 execute d;
end $patch$;
