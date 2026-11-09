-- Build252: reuse corporate-event candidates within one query; preserve ownership and IPO exclusion.
do $patch$ declare d text;begin
select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into d;
if md5(btrim(d,E' \n\r\t'))='6aa21954163a2e536cd1525d10bb69e5' then return;end if;
if md5(btrim(d,E' \n\r\t'))<>'b08fe9c5e0bab487b0dc1a64aad25800' then raise exception 'Build252 definition drift';end if;
d:=replace(d,$a$), evidence as materialized (
$a$,$b$), corporate_candidates as materialized (
 select k.asset_key,coalesce(t.effective_at,t.trade_at) event_at
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_ipo v where t.id=any(v.evidence_ids))
), evidence as materialized (
$b$);
d:=replace(d,$a$ exists(select 1 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_ipo v where t.id=any(v.evidence_ids))
 and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=p.start_date and coalesce(t.effective_at,t.trade_at)<=p.cutoff)$a$,$b$ exists(select 1 from corporate_candidates t where t.asset_key=p.asset_key
 and (t.event_at at time zone 'Asia/Seoul')::date>=p.start_date and t.event_at<=p.cutoff)$b$);
execute d;
end $patch$;

