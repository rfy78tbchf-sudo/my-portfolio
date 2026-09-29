-- Isolated read-only fixtures; same production query, no owner mutations.
with fixture_accounts as (select * from jsonb_to_recordset('[{"id": "a", "user_id": "fixture-owner", "mode": "live", "is_active": true, "provider": "kb_securities", "created_at": "2026-01-01"}]'::jsonb) as f(id text,user_id text,mode text,is_active boolean,provider text,created_at timestamptz)),
fixture_securities as (select * from jsonb_to_recordset('[{"id": "TEST", "symbol": "TEST", "name": "TEST", "currency": "USD", "isin": "TEST"}, {"id": "NO_PRICE", "symbol": "NO_PRICE", "name": "NO_PRICE", "currency": "USD", "isin": "NO_PRICE"}, {"id": "NEG", "symbol": "NEG", "name": "NEG", "currency": "USD", "isin": "NEG"}]'::jsonb) as f(id text,symbol text,name text,currency text,isin text)),
fixture_holdings as (select * from jsonb_to_recordset('[{"account_id": "a", "security_id": "TEST", "quantity": 5, "market_value": 75, "currency": "USD", "fx_rate_to_base": 1100, "as_of": "2026-09-29T06:00:00Z"}, {"account_id": "a", "security_id": "NO_PRICE", "quantity": 1, "market_value": 10, "currency": "USD", "fx_rate_to_base": 1100, "as_of": "2026-09-29T06:00:00Z"}, {"account_id": "a", "security_id": "NEG", "quantity": 1, "market_value": 20, "currency": "USD", "fx_rate_to_base": 1100, "as_of": "2026-09-29T06:00:00Z"}]'::jsonb) as f(account_id text,security_id text,quantity numeric,market_value numeric,currency text,fx_rate_to_base numeric,as_of timestamptz)),
fixture_transactions as (select * from jsonb_to_recordset('[{"account_id": "a", "security_id": "TEST", "type": "buy", "quantity": 5, "price": 10, "net_amount": -51, "currency": "USD", "order_at": "2026-09-10T03:00:00Z", "trade_at": "2026-09-12T03:00:00Z", "provider_payload": {}, "fee": 0, "tax": 0}, {"account_id": "a", "security_id": "TEST", "type": "sell", "quantity": 8, "price": 12, "net_amount": 96, "currency": "USD", "order_at": "2026-09-10T03:00:00Z", "trade_at": "2026-09-12T03:00:00Z", "provider_payload": {}, "fee": 0, "tax": 0}, {"account_id": "a", "security_id": "NEG", "type": "buy", "quantity": 3, "price": 10, "net_amount": -30, "currency": "USD", "order_at": "2026-09-10T03:00:00Z", "trade_at": "2026-09-12T03:00:00Z", "provider_payload": {}, "fee": 0, "tax": 0}]'::jsonb) as f(account_id text,security_id text,type text,quantity numeric,price numeric,net_amount numeric,currency text,order_at timestamptz,trade_at timestamptz,fee numeric,tax numeric,provider_payload jsonb)),
fixture_kb_position_evidence as (select * from jsonb_to_recordset('[{"account_id": "a", "asset_key": "TEST", "symbol": "TEST", "event_type": "sell", "quantity": 8, "price": 12, "gross_amount": 96, "currency": "USD", "order_date": "2026-09-10", "settlement_date": "2026-09-12", "fetched_at": "2026-09-29T08:00:00Z", "active": true, "source": "SPQM2205"}, {"account_id": "a", "asset_key": "TEST", "symbol": "TEST", "event_type": "sell", "quantity": 2, "price": 12, "gross_amount": 23, "currency": "USD", "order_date": "2026-09-10", "settlement_date": "2026-09-30", "fetched_at": "2026-09-29T08:00:00Z", "active": true, "source": "SPQM2205"}]'::jsonb) as f(account_id text,asset_key text,symbol text,event_type text,quantity numeric,price numeric,gross_amount numeric,currency text,order_date date,settlement_date date,fetched_at timestamptz,active boolean,source text)),
fixture_daily_security_prices as (select * from jsonb_to_recordset('[{"security_id": "TEST", "price_date": "2026-08-31", "close": 10, "currency": "USD"}]'::jsonb) as f(security_id text,price_date date,close numeric,currency text)),
fixture_fx_rates as (select * from jsonb_to_recordset('[{"rate_date": "2026-08-31", "base_currency": "USD", "quote_currency": "KRW", "rate": 1000, "source": "fixture"}, {"rate_date": "2026-09-10", "base_currency": "USD", "quote_currency": "KRW", "rate": 1100, "source": "fixture"}]'::jsonb) as f(rate_date date,base_currency text,quote_currency text,rate numeric,source text)),
fixture_dividends as (select * from jsonb_to_recordset('[{"account_id": "a", "security_id": "TEST", "net_amount": 2, "currency": "USD", "paid_at": "2026-09-10T03:00:00Z"}]'::jsonb) as f(account_id text,security_id text,net_amount numeric,currency text,paid_at timestamptz)),
account as materialized (
 select id from fixture_accounts where user_id='fixture-owner' and mode='live'
 and is_active and provider='kb_securities' order by created_at limit 1
), bounds as (
 select case 'THIS_MONTH' when '오늘' then ('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date
 when '1W' then ('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date-6
 when 'THIS_WEEK' then date_trunc('week','2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date
 when 'THIS_MONTH' then date_trunc('month','2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date
 when '1M' then (('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date-interval '1 month')::date
 when '3M' then (('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date-interval '3 months')::date
 when '6M' then (('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date-interval '6 months')::date
 when 'YTD' then date_trunc('year','2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date
 when '1Y' then (('2026-09-29T06:00:00Z'::timestamptz at time zone 'Asia/Seoul')::date-interval '1 year')::date
 when 'ALL' then (select min(coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date from fixture_transactions t join account a on a.id=t.account_id)
 end as start_date,(select max(h.as_of) from fixture_holdings h join account a on a.id=h.account_id) as cutoff
), keys as materialized (
 select s.id,s.symbol,s.name,s.currency,case when s.currency='KRW' then regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1') else coalesce(s.isin,
 (select t.provider_payload->>'stnd_is_cd' from fixture_transactions t join account a on a.id=t.account_id
 where t.security_id=s.id and t.provider_payload->>'stnd_is_cd' ~ '^[A-Z]{2}[A-Z0-9]{10}$' order by t.trade_at desc limit 1),
 regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1')) end as asset_key from fixture_securities s
), ledger as materialized (
 select k.asset_key,t.security_id,t.type,t.quantity,t.currency,
 (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date as day,
 (t.trade_at at time zone 'Asia/Seoul')::date as ledger_day,
 t.order_at is null as provisional_date,
 case when t.type='buy' then -abs(t.net_amount) when t.type='sell' then abs(t.net_amount) end as cash,
 t.price,t.fee,t.tax
 from fixture_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 cross join bounds b where t.type in ('buy','sell') and coalesce(t.order_at,t.trade_at)<=b.cutoff
), pending as materialized (
 select e.asset_key,k.id as security_id,e.event_type as type,e.quantity,e.currency,e.order_date as day,
 false as provisional_date,case when e.event_type='buy' then -abs(e.gross_amount) else abs(e.gross_amount) end as cash,
 e.price
 from fixture_kb_position_evidence e join account a on a.id=e.account_id cross join bounds b
 join lateral(select k.id from keys k where k.asset_key=e.asset_key or k.symbol=e.symbol order by (k.asset_key=e.asset_key) desc limit 1) k on true
 where e.active and e.source='SPQM2205' and e.event_type in ('buy','sell')
 and e.order_date<=(b.cutoff at time zone 'Asia/Seoul')::date
 and not exists(select 1 from ledger t where t.asset_key=e.asset_key and t.type=e.event_type
 and t.quantity=e.quantity and t.ledger_day=e.settlement_date)
), trades as materialized (
 select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,false as pending from ledger
 union all select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,true from pending
), period_trades as (
 select t.* from trades t cross join bounds b where t.day>=b.start_date
), ending as (
 select k.asset_key,(array_agg(h.security_id order by h.as_of desc))[1] security_id,
 sum(h.quantity) qty,sum(h.market_value) value_local,max(h.currency) currency,
 max(h.fx_rate_to_base) end_fx,min(h.as_of) as_of
 from fixture_holdings h join account a on a.id=h.account_id join keys k on k.id=h.security_id
 group by k.asset_key
), flows as (
 select t.asset_key,(array_agg(t.security_id order by t.day desc))[1] security_id,
 sum(case when t.type='buy' then t.quantity else -t.quantity end) delta,
 sum(t.cash) cash_local,sum(t.cash*f.rate) cash_krw,
 count(*) trades,count(*) filter(where t.pending) pending_count,
 count(*) filter(where t.provisional_date) provisional_count,
 count(*) filter(where t.cash is null or t.quantity<=0 or t.price<=0 or
 abs(abs(t.cash)-t.quantity*t.price)>greatest(5,t.quantity*t.price*.05)) bad_amounts,
 count(*) filter(where f.rate is null) missing_fx
 from period_trades t
 left join lateral(select case when t.currency='KRW' then 1::numeric else
 (select x.rate from fixture_fx_rates x where x.base_currency=t.currency and x.quote_currency='KRW'
 and x.rate_date<=t.day and x.rate_date>=t.day-7 order by x.rate_date desc,(x.source='kb_account_snapshot') desc limit 1) end rate) f on true
 group by t.asset_key
), dividends as (
 select k.asset_key,(array_agg(d.security_id order by d.paid_at desc))[1] security_id,
 sum(d.net_amount) local,sum(d.net_amount*f.rate) krw,
 count(*) filter(where f.rate is null) missing_fx
 from fixture_dividends d join account a on a.id=d.account_id join keys k on k.id=d.security_id cross join bounds b
 left join lateral(select case when d.currency='KRW' then 1::numeric else
 (select x.rate from fixture_fx_rates x where x.base_currency=d.currency and x.quote_currency='KRW'
 and x.rate_date<=(d.paid_at at time zone 'Asia/Seoul')::date and x.rate_date>=(d.paid_at at time zone 'Asia/Seoul')::date-7
 order by x.rate_date desc,(x.source='kb_account_snapshot') desc limit 1) end rate) f on true
 where (d.paid_at at time zone 'Asia/Seoul')::date>=b.start_date and d.paid_at<=b.cutoff group by k.asset_key
), ids as (
 select asset_key from ending where qty<>0 union select asset_key from flows union select asset_key from dividends
), positions as (
 select i.asset_key,k.id security_id,k.symbol,k.name,k.currency,
 coalesce(e.qty,0) end_qty,coalesce(e.qty,0)-coalesce(t.delta,0) start_qty,
 case when e.qty>0 then e.value_local else 0 end end_value,coalesce(t.cash_local,0) trade_cash,
 coalesce(t.cash_krw,0) trade_cash_krw,coalesce(d.local,0) dividend,coalesce(d.krw,0) dividend_krw,
 coalesce(t.trades,0) trade_count,coalesce(t.pending_count,0) pending_count,coalesce(t.provisional_count,0) provisional_count,
 coalesce(t.bad_amounts,0) bad_amounts,coalesce(t.missing_fx,0)+coalesce(d.missing_fx,0) missing_fx,
 e.end_fx,e.as_of,b.start_date,b.cutoff
 from ids i left join ending e using(asset_key) left join flows t using(asset_key) left join dividends d using(asset_key)
 join keys k on k.id=coalesce(e.security_id,t.security_id,d.security_id) cross join bounds b
), evidence as (
 select p.*,q.close opening_price,q.price_date opening_date,f.rate opening_fx,
 exists(select 1 from fixture_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date>=p.start_date and coalesce(t.order_at,t.trade_at)<=p.cutoff) corporate_event,
 (select min(x.qty) from (select p.start_qty+sum(d.delta) over(order by d.day) qty from
 (select t.day,sum(case when t.type='buy' then t.quantity else -t.quantity end) delta from period_trades t where t.asset_key=p.asset_key group by t.day) d) x) min_qty
 from positions p
 left join lateral(select x.close,x.price_date from fixture_daily_security_prices x join keys k on k.id=x.security_id
 where k.asset_key=p.asset_key and x.currency=p.currency and x.price_date<p.start_date and x.price_date>=p.start_date-7 and x.close>0
 order by x.price_date desc limit 1) q on p.start_qty>0
 left join lateral(select case when p.currency='KRW' then 1::numeric else
 (select x.rate from fixture_fx_rates x where x.base_currency=p.currency and x.quote_currency='KRW'
 and x.rate_date<p.start_date and x.rate_date>=p.start_date-7 order by x.rate_date desc,(x.source='kb_account_snapshot') desc limit 1) end rate) f on true
), classified as (
 select e.*,case when start_qty<-.000001 or min_qty<-.000001 then '수량 연결 확인 필요'
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
 select count(*) n from fixture_transactions t join account a on a.id=t.account_id cross join bounds b
 where t.security_id is null and t.type in ('buy','sell','dividend') and
 (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date and coalesce(t.order_at,t.trade_at)<=b.cutoff
), result as (
 select count(*) candidates,count(pnl_local) included,count(pnl_krw) krw_included,sum(pnl_krw) total,
 coalesce(jsonb_agg(jsonb_build_object('security_id',security_id,'symbol',symbol,'name',name,'currency',currency,
 'pnl_local',pnl_local,'pnl_krw',pnl_krw,'reason',issue,'start_quantity',start_qty,'end_quantity',end_qty,
 'opening_price',opening_price,'opening_price_date',opening_date,'start_value_local',case when start_qty=0 then 0 else start_qty*opening_price end,
 'end_value_local',end_value,'trade_cash_local',trade_cash,'dividend_local',dividend,'trade_count',trade_count,
 'pending_count',pending_count,'provisional_date_count',provisional_count,'opening_fx',opening_fx,'end_fx',end_fx)
 order by abs(pnl_krw) desc nulls last,symbol),'[]'::jsonb) items from calculated
)
select 1 / case when r.total=59500 and r.included=1 and r.candidates=3
 and (select pnl_local=45 and trade_count=3 and pending_count=1 from calculated where symbol='TEST')
 and (select pnl_local is null and issue='수량 연결 확인 필요' from calculated where symbol='NEG')
 and (select pnl_local is null and issue='시작 가격 확인 필요' from calculated where symbol='NO_PRICE')
 then 1 else 0 end as passed from result r;
