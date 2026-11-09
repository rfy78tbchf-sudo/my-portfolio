-- Experimental only; not a production migration.
do $patch$ declare d text;begin
select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into d;
if md5(btrim(d,E' \n\r\t'))<>'a1c5b0dd24c00467912fc425ce351892' then raise exception 'baseline drift';end if;
d:=replace(d,$a$), closed_cycles as ($a$,$b$), opening_quantities as materialized (
 select k.asset_key,sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end) qty
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<b.start_date
 group by k.asset_key
), closed_cycles as ($b$);
d:=replace(d,$a$and 0=(select coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0)
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<c.start_date)$a$,$b$and 0=coalesce((select q.qty from opening_quantities q where q.asset_key=c.asset_key),0)$b$);
execute d;end $patch$;

