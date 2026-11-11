CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl(p_period text DEFAULT 'THIS_MONTH'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with account as materialized (
 select id from public.accounts where user_id=(select auth.uid()) and mode='live'
 and is_active and provider='kb_securities' order by created_at limit 1
), owned_transactions as materialized (
 select t.* from public.transactions t join account a on a.id=t.account_id
), domestic_date_candidates as materialized (
 -- Independent execution-day evidence. Both sides must have exactly one match.
 select t.id transaction_id,r.id evidence_id,r.realized_date,
 count(*) over(partition by t.id) transaction_matches,
 count(*) over(partition by r.id) evidence_matches
 from owned_transactions t
 join public.realized_pnl_events r on r.account_id=t.account_id
 and r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
 and trim(r.provider_payload->>'stnd_is_cd')=trim(t.provider_payload->>'stnd_is_cd')
 and trim(r.provider_payload->>'trd_dl_ccd')=case t.type when 'buy' then '02' when 'sell' then '01' end
 and r.quantity=t.quantity and r.sell_price=t.price
 and case when t.type='buy' then r.buy_amount else r.sell_amount end=
 case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end
 and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date between (t.trade_at at time zone 'Asia/Seoul')::date-14 and (t.trade_at at time zone 'Asia/Seoul')::date
 where t.source='api' and t.currency='KRW' and t.type in ('buy','sell')
 and t.quantity>0 and t.price>0
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
), individual_dated_transactions as materialized (
 select t.*,coalesce(t.order_at,c.realized_date::timestamp at time zone 'Asia/Seoul') effective_at,
 case when t.order_at is null then c.realized_date end recovered_date
 from owned_transactions t left join domestic_date_candidates c on c.transaction_id=t.id
 and c.transaction_matches=1 and c.evidence_matches=1
), domestic_ledger_groups as materialized (
 select t.account_id,trim(t.provider_payload->>'stnd_is_cd') isin,t.type,
 (t.trade_at at time zone 'Asia/Seoul')::date ledger_date,
 array_agg(t.id) transaction_ids,sum(t.quantity) quantity,
 sum(case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end) gross,
 min((t.effective_at at time zone 'Asia/Seoul')::date) known_min,
 max((t.effective_at at time zone 'Asia/Seoul')::date) known_max
 from individual_dated_transactions t where t.currency='KRW' and t.type in ('buy','sell')
 group by t.account_id,trim(t.provider_payload->>'stnd_is_cd'),t.type,(t.trade_at at time zone 'Asia/Seoul')::date
 having count(*)>1 and bool_and(coalesce(t.source='api' and t.quantity>0 and t.price>0
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
 and case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric=t.quantity*t.price else false end,false))
), domestic_group_candidates as materialized (
 select g.*,r.id evidence_id,r.realized_date,
 count(*) over(partition by g.account_id,g.isin,g.type,g.ledger_date) group_matches,
 count(*) over(partition by r.id) evidence_matches
 from domestic_ledger_groups g join public.realized_pnl_events r on r.account_id=g.account_id
 and r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
 and trim(r.provider_payload->>'stnd_is_cd')=g.isin
 and trim(r.provider_payload->>'trd_dl_ccd')=case g.type when 'buy' then '02' when 'sell' then '01' end
 and r.quantity=g.quantity
 and case when g.type='buy' then r.buy_amount else r.sell_amount end=g.gross
 -- Broker aggregate unit prices can be rounded to the nearest won.
 and r.sell_price>0 and abs(r.sell_price*g.quantity-g.gross)<=g.quantity/2
 and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date between g.ledger_date-14 and g.ledger_date
), safe_individual_dates as (
 select c.* from domestic_date_candidates c
 where c.transaction_matches=1 and c.evidence_matches=1
 and not exists(select 1 from domestic_group_candidates g
 where g.evidence_id=c.evidence_id and not(c.transaction_id=any(g.transaction_ids)))
), group_dates as (
 select unnest(g.transaction_ids) transaction_id,g.realized_date
 from domestic_group_candidates g where group_matches=1 and evidence_matches=1
 and (g.known_min is null or g.known_min=g.realized_date)
 and (g.known_max is null or g.known_max=g.realized_date)
 and not exists(select 1 from domestic_date_candidates c
 where c.evidence_id=g.evidence_id and not(c.transaction_id=any(g.transaction_ids)))
), dated_transactions as materialized (
 select t.*,coalesce(t.order_at,i.realized_date::timestamp at time zone 'Asia/Seoul',
 g.realized_date::timestamp at time zone 'Asia/Seoul') effective_at,
 case when t.order_at is null then coalesce(i.realized_date,g.realized_date) end recovered_date,
 (t.order_at is null and i.realized_date is null and g.realized_date is not null) group_date_recovered
 from owned_transactions t left join safe_individual_dates i on i.transaction_id=t.id
 left join group_dates g on g.transaction_id=t.id
), bounds as (
 select case p_period when '오늘' then (now() at time zone 'Asia/Seoul')::date
 when '1W' then (now() at time zone 'Asia/Seoul')::date-6
 when 'THIS_WEEK' then date_trunc('week',now() at time zone 'Asia/Seoul')::date
 when 'THIS_MONTH' then date_trunc('month',now() at time zone 'Asia/Seoul')::date
 when '1M' then ((now() at time zone 'Asia/Seoul')::date-interval '1 month')::date
 when '3M' then ((now() at time zone 'Asia/Seoul')::date-interval '3 months')::date
 when '6M' then ((now() at time zone 'Asia/Seoul')::date-interval '6 months')::date
 when 'YTD' then date_trunc('year',now() at time zone 'Asia/Seoul')::date
 when '1Y' then ((now() at time zone 'Asia/Seoul')::date-interval '1 year')::date
 when 'ALL' then (select min(coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date from dated_transactions t join account a on a.id=t.account_id)
 end as start_date,(select max(h.as_of) from public.holdings h join account a on a.id=h.account_id) as cutoff
), keys as materialized (
 select s.id,s.symbol,s.name,s.currency,case when s.currency='KRW' then regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1') else coalesce(s.isin,
 (select t.provider_payload->>'stnd_is_cd' from dated_transactions t join account a on a.id=t.account_id
 where t.security_id=s.id and t.provider_payload->>'stnd_is_cd' ~ '^[A-Z]{2}[A-Z0-9]{10}$' order by t.trade_at desc limit 1),
 regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1')) end as asset_key from public.securities s
), verified_domestic_cash as materialized (
 -- A large deduction is not itself an error. Require exact broker cash reconciliation.
 select t.id from dated_transactions t
 where t.source='api' and t.currency='KRW' and t.type='sell'
 and t.quantity>0 and t.price>0 and t.fee>=0 and t.tax>=0 and t.net_amount>=0
 and case when trim(replace(t.provider_payload->>'dl_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(replace(t.provider_payload->>'ec_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(replace(t.provider_payload->>'fee',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'ec_amt'),',','')::numeric=t.net_amount
 and replace(trim(t.provider_payload->>'fee'),',','')::numeric=t.fee
 and replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric-t.fee-t.tax=t.net_amount
 and abs(replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric-t.quantity*t.price)<=t.quantity/2
 else false end
), ipo_records as materialized (
 select t.*,k.asset_key,trim(t.provider_payload->>'smry_nm') ipo_kind,
 case when trim(replace(t.provider_payload->>'dl_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end raw_gross,
 case when trim(replace(t.provider_payload->>'ec_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'ec_amt'),',','')::numeric end raw_cash
 from dated_transactions t join keys k on k.id=t.security_id
 where p_period='ALL' and t.currency='KRW'
 and trim(t.provider_payload->>'smry_nm') in ('공모불입 출금','공모추가납입 출금','공모주환불금 입금','공모주 입고')
), verified_ipo as materialized (
 select asset_key,(array_agg(security_id order by trade_at desc))[1] security_id,
 sum(quantity) filter(where ipo_kind='공모주 입고') quantity,
 max(price) filter(where ipo_kind='공모주 입고') price,
 max(trade_at) filter(where ipo_kind='공모주 입고') acquired_at,
 sum(net_amount) cash,array_agg(id) evidence_ids
 from ipo_records t cross join bounds b
 group by asset_key
 having count(*) filter(where ipo_kind='공모주 입고')=1
 and count(*) filter(where ipo_kind='공모불입 출금')=1
 and count(*) filter(where ipo_kind='공모추가납입 출금')<=1
 and count(*) filter(where ipo_kind='공모주환불금 입금')<=1
 and bool_and(coalesce(source='api' and fee>=0 and tax=0 and price>0 and trade_at<=b.cutoff
 and case when ipo_kind='공모주 입고' then type='transfer_in' and quantity>0 and net_amount=0 and raw_cash=0
 when ipo_kind='공모주환불금 입금' then type='other' and net_amount>=0 and raw_cash=net_amount and raw_gross-fee=net_amount
 else type='other' and net_amount<0 and raw_cash=-net_amount and raw_gross+fee=-net_amount end,false))
 and min(price)=max(price)
 and max(trade_at) filter(where ipo_kind<>'공모주 입고')<=max(trade_at) filter(where ipo_kind='공모주 입고')
 and -sum(case when ipo_kind='공모주환불금 입금' then raw_gross when ipo_kind='공모주 입고' then 0 else -raw_gross end)
 =sum(quantity) filter(where ipo_kind='공모주 입고')*max(price) filter(where ipo_kind='공모주 입고')
 and sum(net_amount)<0
 and not exists(select 1 from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='buy')
 and not exists(select 1 from public.holdings h join account a on a.id=h.account_id join keys k on k.id=h.security_id where k.asset_key=t.asset_key and h.quantity<>0)
 and (select sum(x.quantity) from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='sell')=sum(quantity) filter(where ipo_kind='공모주 입고')
 and not exists(select 1 from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='sell' and ((coalesce(x.effective_at,x.trade_at) at time zone 'Asia/Seoul')::date<(max(t.trade_at) filter(where t.ipo_kind='공모주 입고') at time zone 'Asia/Seoul')::date or coalesce(x.effective_at,x.trade_at)>max(b.cutoff) or not exists(select 1 from verified_domestic_cash v where v.id=x.id)))
), ledger as materialized (
 select k.asset_key,t.security_id,t.type,t.quantity,t.currency,
 (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date as day,
 (t.trade_at at time zone 'Asia/Seoul')::date as ledger_day,
 t.effective_at is null as provisional_date,t.recovered_date,t.group_date_recovered,
 case when t.type='buy' then -abs(t.net_amount) when t.type='sell' then abs(t.net_amount) end as cash,
 t.price,t.fee,t.tax,exists(select 1 from verified_domestic_cash v where v.id=t.id) cash_verified
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 cross join bounds b where t.type in ('buy','sell') and coalesce(t.effective_at,t.trade_at)<=b.cutoff
), pending as materialized (
 select e.asset_key,k.id as security_id,e.event_type as type,e.quantity,e.currency,e.order_date as day,
 false as provisional_date,case when e.event_type='buy' then -abs(e.gross_amount) else abs(e.gross_amount) end as cash,
 e.price
 from public.kb_position_evidence e join account a on a.id=e.account_id cross join bounds b
 join lateral(select k.id from keys k where k.asset_key=e.asset_key or k.symbol=e.symbol order by (k.asset_key=e.asset_key) desc limit 1) k on true
 where e.active and e.source='SPQM2205' and e.event_type in ('buy','sell')
 and e.order_date<=(b.cutoff at time zone 'Asia/Seoul')::date
 and not exists(select 1 from ledger t where t.asset_key=e.asset_key and t.type=e.event_type
 and t.quantity=e.quantity and t.ledger_day=e.settlement_date)
), trades as materialized (
 select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,false as pending,recovered_date,group_date_recovered,cash_verified from ledger
 union all select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,true,null::date,false,false from pending
 union all select asset_key,security_id,'buy',quantity,'KRW',(acquired_at at time zone 'Asia/Seoul')::date,false,cash,price,false,null::date,false,true from verified_ipo
), period_trades as (
 select t.* from trades t cross join bounds b where t.day>=b.start_date
), ending as (
 select k.asset_key,(array_agg(h.security_id order by h.as_of desc))[1] security_id,
 sum(h.quantity) qty,sum(h.market_value) value_local,max(h.currency) currency,
 max(h.fx_rate_to_base) end_fx,min(h.as_of) as_of
 from public.holdings h join account a on a.id=h.account_id join keys k on k.id=h.security_id
 group by k.asset_key
), flows as (
 select t.asset_key,(array_agg(t.security_id order by t.day desc))[1] security_id,
 sum(case when t.type='buy' then t.quantity else -t.quantity end) delta,
 sum(t.cash) cash_local,sum(t.cash*f.rate) cash_krw,
 count(*) trades,count(*) filter(where t.pending) pending_count,
 count(*) filter(where t.provisional_date) provisional_count,
 count(*) filter(where t.recovered_date is not null) verified_date_count,
 count(*) filter(where t.group_date_recovered) grouped_date_count,
 count(*) filter(where t.cash is null or t.quantity<=0 or t.price<=0 or
 (abs(abs(t.cash)-t.quantity*t.price)>greatest(5,t.quantity*t.price*.05) and not t.cash_verified)) bad_amounts,
 count(*) filter(where f.rate is null) missing_fx
 from period_trades t
 left join lateral(select case when t.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=t.currency and x.quote_currency='KRW'
 and x.rate_date<=t.day and x.rate_date>=t.day-7 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
 group by t.asset_key
), dividends as (
 select k.asset_key,(array_agg(d.security_id order by d.paid_at desc))[1] security_id,
 sum(d.net_amount) local,sum(d.net_amount*f.rate) krw,
 count(*) filter(where f.rate is null) missing_fx
 from public.dividends d join account a on a.id=d.account_id join keys k on k.id=d.security_id cross join bounds b
 left join lateral(select case when d.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=d.currency and x.quote_currency='KRW'
 and x.rate_date<=(d.paid_at at time zone 'Asia/Seoul')::date and x.rate_date>=(d.paid_at at time zone 'Asia/Seoul')::date-7
 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
 where (d.paid_at at time zone 'Asia/Seoul')::date>=b.start_date and d.paid_at<=b.cutoff group by k.asset_key
), ids as (
 select asset_key from ending where qty<>0 union select asset_key from flows union select asset_key from dividends
), positions as (
 select i.asset_key,k.id security_id,k.symbol,k.name,k.currency,
 coalesce(e.qty,0) end_qty,coalesce(e.qty,0)-coalesce(t.delta,0) start_qty,
 case when e.qty>0 then e.value_local else 0 end end_value,coalesce(t.cash_local,0) trade_cash,
 coalesce(t.cash_krw,0) trade_cash_krw,coalesce(d.local,0) dividend,coalesce(d.krw,0) dividend_krw,
 coalesce(t.trades,0) trade_count,coalesce(t.pending_count,0) pending_count,coalesce(t.provisional_count,0) provisional_count,
 coalesce(t.verified_date_count,0) verified_date_count,
 coalesce(t.grouped_date_count,0) grouped_date_count,
 coalesce(t.bad_amounts,0) bad_amounts,coalesce(t.missing_fx,0)+coalesce(d.missing_fx,0) missing_fx,
 e.end_fx,e.as_of,b.start_date,b.cutoff
 from ids i left join ending e using(asset_key) left join flows t using(asset_key) left join dividends d using(asset_key)
 join keys k on k.id=coalesce(e.security_id,t.security_id,d.security_id) cross join bounds b
), evidence as (
 select p.*,case when snap.quantity>0 then snap.market_value/snap.quantity else q.close end opening_price,
 case when snap.quantity>0 then p.start_date-1 else q.price_date end opening_date,
 case when snap.quantity>0 then snap.fx else f.rate end opening_fx,
 case when snap.quantity>0 then 'account_snapshot' else 'historical_close' end opening_basis,
 (snap.quantity is not null and abs(snap.quantity-p.start_qty)>.000001) snapshot_quantity_mismatch,
 (p_period='오늘' and p.start_qty>0 and snap.quantity is null) today_snapshot_missing,
 exists(select 1 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_ipo v where t.id=any(v.evidence_ids))
 and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=p.start_date and coalesce(t.effective_at,t.trade_at)<=p.cutoff) corporate_event,
 (select min(x.qty) from (select p.start_qty+sum(d.delta) over(order by d.day) qty from
 (select t.day,sum(case when t.type='buy' then t.quantity else -t.quantity end) delta from period_trades t where t.asset_key=p.asset_key group by t.day) d) x) min_qty
 from positions p
 left join lateral(
 select sum(h.quantity) quantity,sum(h.market_value) market_value,min(h.fx_rate_to_base) fx
 from public.daily_security_snapshots h join account a on a.id=h.account_id
 join keys k on k.id=h.security_id
 join public.daily_account_snapshots d on d.account_id=h.account_id and d.snapshot_date=h.snapshot_date
 where k.asset_key=p.asset_key and h.snapshot_date=p.start_date-1 and h.currency=p.currency
 having count(*)>0 and bool_and(h.updated_at=d.snapshot_at and h.quantity>0 and h.market_value>0 and h.fx_rate_to_base>0)
 and min(h.fx_rate_to_base)=max(h.fx_rate_to_base)
 ) snap on true
 left join lateral(select x.close,x.price_date from public.daily_security_prices x join keys k on k.id=x.security_id
 where k.asset_key=p.asset_key and x.currency=p.currency and x.price_date<p.start_date and x.price_date>=p.start_date-7 and x.close>0
 order by x.price_date desc limit 1) q on p.start_qty>0
 left join lateral(select case when p.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=p.currency and x.quote_currency='KRW'
 and x.rate_date<p.start_date and x.rate_date>=p.start_date-7 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
), classified as (
 select e.*,case when start_qty<-.000001 or min_qty<-.000001 then '수량 연결 확인 필요'
 when provisional_count>0 then '거래일 확인 필요'
 when snapshot_quantity_mismatch then '시작 보유수량 확인 필요'
 when today_snapshot_missing then '전날 잔고 관측 필요'
 when corporate_event then '분할·이관 확인 필요'
 when bad_amounts>0 then '거래 금액 확인 필요'
 when end_qty>0 and (end_value is null or as_of<cutoff-interval '1 day') then '마지막 잔고 확인 필요'
 when start_qty>0 and opening_price is null then '시작 가격 확인 필요'
 else null end issue,
 (currency='KRW' or (missing_fx=0 and (start_qty=0 or opening_fx is not null) and (end_qty=0 or end_fx is not null))) krw_ready
 from evidence e
), calculated as (
 select c.*,case when issue is null then end_value-case when start_qty>0 then start_qty*opening_price else 0 end+trade_cash+dividend end pnl_local,
 case when issue is null and krw_ready then end_value*coalesce(end_fx,1)-case when start_qty>0 then start_qty*opening_price*opening_fx else 0 end+trade_cash_krw+dividend_krw end pnl_krw
 from classified c
), gaps as (
 select count(*) n from dated_transactions t join account a on a.id=t.account_id cross join bounds b
 where t.security_id is null and t.type in ('buy','sell','dividend') and
 (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date and coalesce(t.effective_at,t.trade_at)<=b.cutoff
), closed_sources as (
 select k.asset_key,count(*) trades,count(*) filter(where t.type='sell') sales,
 count(*) filter(where t.effective_at is null) provisional,
 sum(t.net_amount) cash,
 bool_and(coalesce(t.source='api' and t.quantity>0 and t.fee is not null and t.tax is not null
 and case when trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then abs(abs(t.net_amount)-(replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric+
 case when t.type='buy' then t.fee+t.tax else -t.fee-t.tax end))<=0.02 else false end
 and (t.type='buy' and t.net_amount<0 or t.type='sell' and t.net_amount>=0),false)) valid
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where t.type in ('buy','sell') and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date
 and coalesce(t.effective_at,t.trade_at)<=b.cutoff group by k.asset_key
), closed_cycles as (
 select c.asset_key,jsonb_build_object('method','flat_to_flat_net_cash','realized_local',z.cash,
 'realized_krw',c.trade_cash_krw,'sale_count',z.sales,'provisional_date_count',z.provisional) value
 from calculated c join closed_sources z using(asset_key)
 where c.issue is null and c.krw_ready and c.start_qty=0 and c.end_qty=0 and c.pending_count=0
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and 0=(select coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0)
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<c.start_date)
), split_records as materialized (
 select t.*,k.asset_key,(t.trade_at at time zone 'Asia/Seoul')::date split_day
 from dated_transactions t join keys k on k.id=t.security_id cross join bounds b
 where p_period='ALL' and t.type in ('split_in','split_out')
 and t.trade_at<=b.cutoff
), verified_split_pairs as materialized (
 select asset_key,split_day,array_agg(id) evidence_ids,
 sum(quantity) filter(where type='split_out') outgoing_quantity,
 sum(case when type='split_in' then quantity else -quantity end) delta
 from split_records
 group by asset_key,split_day
 having count(*)=2 and count(*) filter(where type='split_in')=1 and count(*) filter(where type='split_out')=1
 and bool_and(coalesce(source='api' and currency<>'KRW' and quantity>0 and net_amount=0
 and trim(provider_payload->>'smry_nm')=case type when 'split_in' then '액면분할 입고' else '액면분할 출고' end
 and case when trim(replace(provider_payload->>'q',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(provider_payload->>'ec_amt') ~ '^0+$'
 then replace(trim(provider_payload->>'q'),',','')::numeric=quantity else false end,false))
 and sum(quantity) filter(where type='split_in')>sum(quantity) filter(where type='split_out')
), verified_split_history as materialized (
 select c.asset_key,z.cash+c.dividend pnl_local,'split_closed'::text basis
 from calculated c join closed_sources z using(asset_key)
 where p_period='ALL' and c.currency<>'KRW' and c.issue='거래일 확인 필요'
 and c.end_qty=0 and c.pending_count=0 and c.bad_amounts=0
 and not coalesce(c.snapshot_quantity_mismatch,false)
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and not exists(select 1 from verified_split_pairs v where v.asset_key=c.asset_key and v.outgoing_quantity<>
 coalesce((select sum(case when t.type='buy' then t.quantity else -t.quantity end) from period_trades t where t.asset_key=c.asset_key and t.day<v.split_day),0)+coalesce((select sum(v2.delta) from verified_split_pairs v2 where v2.asset_key=c.asset_key and v2.split_day<v.split_day),0))
 and c.start_qty=(select sum(v.delta) from verified_split_pairs v where v.asset_key=c.asset_key)
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key and t.type in ('buy','sell'))
 and not exists(select 1 from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key
 and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_split_pairs v where t.id=any(v.evidence_ids)))
 and 0<=(select min(qty) from (
 select sum(delta) over(order by day) qty from (
 select day,sum(delta) delta from (
 select t.day,case when t.type='buy' then t.quantity else -t.quantity end delta from period_trades t where t.asset_key=c.asset_key
 union all select v.split_day,v.delta from verified_split_pairs v where v.asset_key=c.asset_key
 ) events group by day) days) running)
), verified_plain_local_history as materialized (
 -- Whole-history, fully closed foreign positions need no intraday cost allocation.
 -- Missing execution dates still block KRW conversion and every bounded period.
 select c.asset_key,c.end_value+z.cash+c.dividend pnl_local,case when c.end_qty>0 then 'held' else 'closed' end basis
 from calculated c join closed_sources z using(asset_key)
 where p_period='ALL' and c.currency<>'KRW' and c.issue='거래일 확인 필요'
 and c.start_qty=0 and c.end_qty>=0 and c.pending_count=0
 and (c.end_qty=0 or (c.end_value>0 and c.as_of=c.cutoff))
 and c.min_qty>=0 and not c.corporate_event and c.bad_amounts=0
 and not coalesce(c.snapshot_quantity_mismatch,false)
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 -- Reject omitted earlier/later trades; never repair missing dates by inference.
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and t.type in ('buy','sell'))
), verified_local_history as materialized (
 select * from verified_plain_local_history union all select * from verified_split_history
), result as (
 select count(*) candidates,count(pnl_local) included,count(pnl_krw) krw_included,sum(pnl_krw) total,
 sum(end_value*coalesce(end_fx,1)) filter(where pnl_krw is not null) ending_krw,
 sum(case when start_qty>0 then start_qty*opening_price*opening_fx else 0 end) filter(where pnl_krw is not null) opening_krw,
 sum(trade_cash_krw) filter(where pnl_krw is not null) trade_cash_krw,
 sum(dividend_krw) filter(where pnl_krw is not null) dividend_krw,
 coalesce(jsonb_agg(jsonb_build_object('security_id',security_id,'symbol',symbol,'name',name,'currency',currency,
 'ipo_acquisition',exists(select 1 from verified_ipo v where v.asset_key=calculated.asset_key),'closed_realized',(select z.value from closed_cycles z where z.asset_key=calculated.asset_key),'aliases',(select jsonb_agg(distinct k.symbol) from keys k where k.asset_key=calculated.asset_key),'pnl_local',coalesce(pnl_local,(select v.pnl_local from verified_local_history v where v.asset_key=calculated.asset_key)),'local_history_basis',(select v.basis from verified_local_history v where v.asset_key=calculated.asset_key),'local_cash_only',exists(select 1 from verified_local_history v where v.asset_key=calculated.asset_key),'pnl_krw',pnl_krw,'reason',issue,'start_quantity',case when exists(select 1 from verified_split_history v where v.asset_key=calculated.asset_key) then 0 else start_qty end,'end_quantity',end_qty,
 'opening_basis',opening_basis,'opening_price',opening_price,'opening_price_date',opening_date,'start_value_local',case when exists(select 1 from verified_split_history v where v.asset_key=calculated.asset_key) or start_qty=0 then 0 else start_qty*opening_price end,
 'end_value_local',end_value,'trade_cash_local',trade_cash,'dividend_local',dividend,'trade_count',trade_count,
 'pending_count',pending_count,'provisional_date_count',provisional_count,'verified_date_count',verified_date_count,'grouped_date_count',grouped_date_count,'opening_fx',opening_fx,'end_fx',end_fx)
 order by abs(pnl_krw) desc nulls last,symbol),'[]'::jsonb) items from calculated
)
select jsonb_build_object('ok',exists(select 1 from account),'period',p_period,'period_start',b.start_date,
 'period_end',(b.cutoff at time zone 'Asia/Seoul')::date,'basis_at',b.cutoff,'scope','KB 종합위탁 · 주식',
 'method','ending_minus_opening_plus_net_trades_dividends','included_count',r.included,'candidate_count',r.candidates,
 'local_only_count',(select count(*) from verified_local_history),'krw_included_count',r.krw_included,'pnl_krw',r.total,'complete',r.candidates>0 and r.krw_included=r.candidates and (select n from gaps)=0,'unmapped_count',(select n from gaps),
 'calculation',jsonb_build_object('opening_krw',r.opening_krw,'ending_krw',r.ending_krw,'net_trade_cash_krw',r.trade_cash_krw,'dividend_krw',r.dividend_krw,'difference_krw',r.total-(r.ending_krw-r.opening_krw+r.trade_cash_krw+r.dividend_krw)),'items',r.items,'krw_basis','거래일별 참고 환율 · 현금 환차손익 별도') from result r cross join bounds b;
$function$


