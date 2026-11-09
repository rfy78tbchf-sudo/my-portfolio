-- Reconcile a domestic opening boundary only when verified unsettled trades
-- explain the entire prior snapshot discrepancy and a later snapshot agrees.
-- No financial rows, cost bases, security policies or existing USD rules change.
do $patch$
declare d text;
begin
 select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into d;
 if md5(btrim(d,E' \n\r\t'))='f1a27d7de13ff0c0ad2ef4b7890d04f3' then return; end if;
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
), opening_boundary_checks as materialized ($new$);
 d:=replace(d,$old$where p.currency='USD' and p_period<>'오늘' and p.start_qty>0 and p.provisional_count=0$old$,$new$where (p.currency='USD' or (p.currency='KRW' and exists (
 select 1 from domestic_opening_settlement_checks dc where dc.asset_key=p.asset_key and dc.settled_through<=h.snapshot_date
 ))) and p_period<>'오늘' and p.start_qty>0 and p.provisional_count=0$new$);
 execute d;
end $patch$;
