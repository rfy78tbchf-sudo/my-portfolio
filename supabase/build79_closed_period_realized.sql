-- Build78: shared deterministic historical FX policy; expose actual period inputs.
-- No account/transaction/decision mutations or auth changes.
CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl(p_period text DEFAULT 'THIS_MONTH'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with account as materialized (
 select id from public.accounts where user_id=(select auth.uid()) and mode='live'
 and is_active and provider='kb_securities' order by created_at limit 1
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
 when 'ALL' then (select min(coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date from public.transactions t join account a on a.id=t.account_id)
 end as start_date,(select max(h.as_of) from public.holdings h join account a on a.id=h.account_id) as cutoff
), keys as materialized (
 select s.id,s.symbol,s.name,s.currency,case when s.currency='KRW' then regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1') else coalesce(s.isin,
 (select t.provider_payload->>'stnd_is_cd' from public.transactions t join account a on a.id=t.account_id
 where t.security_id=s.id and t.provider_payload->>'stnd_is_cd' ~ '^[A-Z]{2}[A-Z0-9]{10}$' order by t.trade_at desc limit 1),
 regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1')) end as asset_key from public.securities s
), ledger as materialized (
 select k.asset_key,t.security_id,t.type,t.quantity,t.currency,
 (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date as day,
 (t.trade_at at time zone 'Asia/Seoul')::date as ledger_day,
 t.order_at is null as provisional_date,
 case when t.type='buy' then -abs(t.net_amount) when t.type='sell' then abs(t.net_amount) end as cash,
 t.price,t.fee,t.tax
 from public.transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 cross join bounds b where t.type in ('buy','sell') and coalesce(t.order_at,t.trade_at)<=b.cutoff
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
 select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,false as pending from ledger
 union all select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,true from pending
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
 count(*) filter(where t.cash is null or t.quantity<=0 or t.price<=0 or
 abs(abs(t.cash)-t.quantity*t.price)>greatest(5,t.quantity*t.price*.05)) bad_amounts,
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
 coalesce(t.bad_amounts,0) bad_amounts,coalesce(t.missing_fx,0)+coalesce(d.missing_fx,0) missing_fx,
 e.end_fx,e.as_of,b.start_date,b.cutoff
 from ids i left join ending e using(asset_key) left join flows t using(asset_key) left join dividends d using(asset_key)
 join keys k on k.id=coalesce(e.security_id,t.security_id,d.security_id) cross join bounds b
), evidence as (
 select p.*,q.close opening_price,q.price_date opening_date,f.rate opening_fx,
 exists(select 1 from public.transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date>=p.start_date and coalesce(t.order_at,t.trade_at)<=p.cutoff) corporate_event,
 (select min(x.qty) from (select p.start_qty+sum(d.delta) over(order by d.day) qty from
 (select t.day,sum(case when t.type='buy' then t.quantity else -t.quantity end) delta from period_trades t where t.asset_key=p.asset_key group by t.day) d) x) min_qty
 from positions p
 left join lateral(select x.close,x.price_date from public.daily_security_prices x join keys k on k.id=x.security_id
 where k.asset_key=p.asset_key and x.currency=p.currency and x.price_date<p.start_date and x.price_date>=p.start_date-7 and x.close>0
 order by x.price_date desc limit 1) q on p.start_qty>0
 left join lateral(select case when p.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=p.currency and x.quote_currency='KRW'
 and x.rate_date<p.start_date and x.rate_date>=p.start_date-7 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
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
 select count(*) n from public.transactions t join account a on a.id=t.account_id cross join bounds b
 where t.security_id is null and t.type in ('buy','sell','dividend') and
 (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date and coalesce(t.order_at,t.trade_at)<=b.cutoff
), closed_sources as (
 select k.asset_key,count(*) trades,count(*) filter(where t.type='sell') sales,
 count(*) filter(where t.order_at is null) provisional,
 sum(t.net_amount) cash,
 bool_and(coalesce(t.source='api' and t.quantity>0 and t.fee is not null and t.tax is not null
 and case when trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then abs(abs(t.net_amount)-(replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric+
 case when t.type='buy' then t.fee+t.tax else -t.fee-t.tax end))<=0.02 else false end
 and (t.type='buy' and t.net_amount<0 or t.type='sell' and t.net_amount>=0),false)) valid
 from public.transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where t.type in ('buy','sell') and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date
 and coalesce(t.order_at,t.trade_at)<=b.cutoff group by k.asset_key
), closed_cycles as (
 select c.asset_key,jsonb_build_object('method','flat_to_flat_net_cash','realized_local',z.cash,
 'realized_krw',c.trade_cash_krw,'sale_count',z.sales,'provisional_date_count',z.provisional) value
 from calculated c join closed_sources z using(asset_key)
 where c.issue is null and c.krw_ready and c.start_qty=0 and c.end_qty=0 and c.pending_count=0
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and 0=(select coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0)
 from public.transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<c.start_date)
), result as (
 select count(*) candidates,count(pnl_local) included,count(pnl_krw) krw_included,sum(pnl_krw) total,
 sum(end_value*coalesce(end_fx,1)) filter(where pnl_krw is not null) ending_krw,
 sum(case when start_qty>0 then start_qty*opening_price*opening_fx else 0 end) filter(where pnl_krw is not null) opening_krw,
 sum(trade_cash_krw) filter(where pnl_krw is not null) trade_cash_krw,
 sum(dividend_krw) filter(where pnl_krw is not null) dividend_krw,
 coalesce(jsonb_agg(jsonb_build_object('security_id',security_id,'symbol',symbol,'name',name,'currency',currency,
 'closed_realized',(select z.value from closed_cycles z where z.asset_key=calculated.asset_key),'aliases',(select jsonb_agg(distinct k.symbol) from keys k where k.asset_key=calculated.asset_key),'pnl_local',pnl_local,'pnl_krw',pnl_krw,'reason',issue,'start_quantity',start_qty,'end_quantity',end_qty,
 'opening_price',opening_price,'opening_price_date',opening_date,'start_value_local',case when start_qty=0 then 0 else start_qty*opening_price end,
 'end_value_local',end_value,'trade_cash_local',trade_cash,'dividend_local',dividend,'trade_count',trade_count,
 'pending_count',pending_count,'provisional_date_count',provisional_count,'opening_fx',opening_fx,'end_fx',end_fx)
 order by abs(pnl_krw) desc nulls last,symbol),'[]'::jsonb) items from calculated
)
select jsonb_build_object('ok',exists(select 1 from account),'period',p_period,'period_start',b.start_date,
 'period_end',(b.cutoff at time zone 'Asia/Seoul')::date,'basis_at',b.cutoff,'scope','KB 종합위탁 · 주식',
 'method','ending_minus_opening_plus_net_trades_dividends','included_count',r.included,'candidate_count',r.candidates,
 'krw_included_count',r.krw_included,'pnl_krw',r.total,'complete',r.candidates>0 and r.krw_included=r.candidates and (select n from gaps)=0,'unmapped_count',(select n from gaps),
 'calculation',jsonb_build_object('opening_krw',r.opening_krw,'ending_krw',r.ending_krw,'net_trade_cash_krw',r.trade_cash_krw,'dividend_krw',r.dividend_krw,'difference_krw',r.total-(r.ending_krw-r.opening_krw+r.trade_cash_krw+r.dividend_krw)),'items',r.items,'krw_basis','거래일별 참고 환율 · 현금 환차손익 별도') from result r cross join bounds b;
$function$;


CREATE OR REPLACE FUNCTION public.get_live_realized_sales(p_period text DEFAULT '1M'::text, p_account uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_account uuid;
  v_provider text;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start date;
  v_security record;
  v_day record;
  v_trade record;
  v_qty numeric;
  v_cost numeric;
  v_krw_cost numeric;
  v_alloc numeric;
  v_krw_alloc numeric;
  v_rate numeric;
  v_rate_day date;
  v_rate_source text;
  v_latest_rate numeric;
  v_latest_day date;
  v_latest_source text;
  v_known boolean;
  v_krw_known boolean;
  v_valid boolean;
  v_mixed boolean;
  v_date date;
  v_gross numeric;
  v_status text;
  v_period jsonb;
  v_closed jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_complete integer := 0;
  v_partial integer := 0;
  v_order integer := 0;
  v_direct_order integer := 0;
  v_carried_order integer := 0;
  v_cost_missing integer := 0;
  v_source_missing integer := 0;
  v_seen_mixed date;
  v_issue_origin date;
  v_day_valid boolean;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_period not in ('오늘','TODAY','1W','1M','THIS_MONTH','3M','6M','YTD','1Y','ALL')
    then raise exception 'invalid period'; end if;
  select a.id,a.provider into v_account,v_provider from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
      and (p_account is null and a.provider='kb_securities' or a.id=p_account)
    order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','ACCOUNT_NOT_FOUND'); end if;
  v_start:=case p_period when '오늘' then v_today when 'TODAY' then v_today
    when '1W' then v_today-6 when '1M' then (v_today-interval '1 month')::date
    when 'THIS_MONTH' then date_trunc('month',v_today::timestamp)::date
    when '3M' then (v_today-interval '3 months')::date
    when '6M' then (v_today-interval '6 months')::date
    when 'YTD' then make_date(extract(year from v_today)::integer,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    else '1900-01-01'::date end;
  for v_security in
    select s.id,s.symbol,s.name from public.securities s
    where exists(select 1 from public.transactions t
      where t.account_id=v_account and t.security_id=s.id and t.type='sell'
        and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date
          between v_start and v_today)
    order by s.symbol,s.id
  loop
    v_qty:=0;v_cost:=0;v_krw_cost:=0;v_known:=true;v_krw_known:=true;v_seen_mixed:=null;
    for v_day in
      select (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date d,
        count(*) filter(where t.type='buy') buys,
        count(*) filter(where t.type='sell') sells,
        coalesce(sum(case when t.type='buy' then t.quantity
          when t.type='sell' then -t.quantity else 0 end),0) net_quantity,
        count(*) filter(where t.type in ('split_in','split_out','transfer_in','transfer_out','corporate_in','corporate_out','stock_split','reverse_split','merger','spinoff','symbol_change','account_transfer','broker_transfer_in','broker_transfer_out')) other_events
      from public.transactions t
      where t.account_id=v_account and t.security_id=v_security.id
        and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<=v_today
      group by 1 order by 1
    loop
      v_mixed:=v_day.buys>0 and v_day.sells>0;
      if v_day.other_events>0 then v_known:=false;v_krw_known:=false;end if;
      if v_mixed then
        -- No intraday execution timestamp exists. KB daily ledger sequence is
        -- not evidence of execution order. Only the daily net quantity is safe.
        v_seen_mixed:=v_day.d;
        v_known:=false;v_krw_known:=false;
        v_day_valid:=true;
        for v_trade in
          select t.* from public.transactions t
          where t.account_id=v_account and t.security_id=v_security.id and t.type in ('buy','sell')
            and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date=v_day.d
          order by t.id
        loop
          v_gross:=null;
          if trim(replace(coalesce(v_trade.provider_payload->>'dl_amt',''),',',''))
              ~ '^[0-9]+(\.[0-9]+)?$' then
            v_gross:=replace(trim(v_trade.provider_payload->>'dl_amt'),',','')::numeric;
          end if;
          v_valid:=coalesce(v_trade.source='api' and v_trade.quantity>0
            and v_trade.net_amount is not null and v_trade.fee is not null
            and v_trade.tax is not null and v_gross is not null
            and abs(abs(v_trade.net_amount)-(v_gross+
              case when v_trade.type='buy' then v_trade.fee+v_trade.tax
                else -v_trade.fee-v_trade.tax end))<=0.02
            and (v_trade.type='buy' and v_trade.net_amount<0 or
                 v_trade.type='sell' and v_trade.net_amount>=0),false);
          if not v_valid then v_day_valid:=false;end if;
          if v_trade.type='sell' and v_day.d between v_start and v_today then
            v_count:=v_count+1;
            if v_valid then v_order:=v_order+1;v_direct_order:=v_direct_order+1;
            else v_source_missing:=v_source_missing+1;end if;
            v_items:=v_items||jsonb_build_array(jsonb_build_object(
              'transaction_id',v_trade.id,'source_transaction_id',v_trade.external_id,
              'symbol',v_security.symbol,'name',v_security.name,
              'trade_date',v_day.d,'ledger_date',(v_trade.trade_at at time zone 'Asia/Seoul')::date,
              'date_basis',case when v_trade.order_at is null then 'ledger_date_execution_unverified'
                else 'broker_order_date_no_intraday_time' end,
              'status',case when v_valid then 'order_unverified' else 'source_review' end,'issue_date',v_day.d,
              'issue',case when v_valid then 'same_day_buy_sell_execution_order' else 'mixed_day_source_invalid' end,
              'issue_category',case when v_valid then 'direct_mixed_day' else 'source_invalid_mixed_day' end,
              'missing_fields',case when v_valid then jsonb_build_array('execution_order','execution_timestamp',
                case when v_trade.order_at is null then 'execution_date' else 'execution_date_confirmation' end)
                else jsonb_build_array('reconciled_gross_net_fee_tax') end,
              'affected_metrics',jsonb_build_array('sale_allocated_cost','sale_realized_pnl','remaining_cost'),
              'resolution_condition','official fill time/sequence or proven order invariant allocation',
              'quantity',v_trade.quantity,'currency',v_trade.currency,
              'net_proceeds',case when v_valid then v_trade.net_amount else null end,'allocated_cost',null,
              'realized_local',null,'fee',v_trade.fee,'tax',v_trade.tax));
          end if;
        end loop;
        v_qty:=v_qty+v_day.net_quantity;
        if v_qty=0 and v_day_valid then v_cost:=0;v_krw_cost:=0;v_known:=true;v_krw_known:=true;end if;
        continue;
      end if;
      for v_trade in
        select t.* from public.transactions t
        where t.account_id=v_account and t.security_id=v_security.id
          and t.type in ('buy','sell')
          and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date=v_day.d
        order by t.trade_at,t.id
      loop
        v_date:=v_day.d;
        v_gross:=null;
        if trim(replace(coalesce(v_trade.provider_payload->>'dl_amt',''),',',''))
            ~ '^[0-9]+(\.[0-9]+)?$' then
          v_gross:=replace(trim(v_trade.provider_payload->>'dl_amt'),',','')::numeric;
        end if;
        v_valid:=coalesce(v_trade.source='api' and v_trade.quantity>0
          and v_trade.net_amount is not null and v_trade.fee is not null
          and v_trade.tax is not null and v_gross is not null
          and abs(abs(v_trade.net_amount)-(v_gross+
            case when v_trade.type='buy' then v_trade.fee+v_trade.tax
              else -v_trade.fee-v_trade.tax end))<=0.02
          and (v_trade.type='buy' and v_trade.net_amount<0 or
               v_trade.type='sell' and v_trade.net_amount>=0),false);
        v_rate:=null;v_rate_day:=null;v_rate_source:=null;
        if v_trade.currency='KRW' then
          v_rate:=1;v_rate_day:=v_date;v_rate_source:='transaction_currency_krw';
        elsif v_trade.currency='USD' then
          select f.rate,f.rate_date,f.source into v_rate,v_rate_day,v_rate_source
          from public.fx_rates f where f.base_currency='USD'
            and f.quote_currency='KRW' and f.rate_date between v_date-7 and v_date
            and f.rate>0 order by f.rate_date desc,(f.source='kb_account_snapshot') desc nulls last,f.observed_at desc nulls last,f.source,f.rate desc limit 1;
        end if;
        if v_trade.type='buy' then
          v_qty:=v_qty+coalesce(v_trade.quantity,0);
          if not v_valid then v_known:=false;v_krw_known:=false;
          elsif v_known then v_cost:=v_cost-v_trade.net_amount;end if;
          if v_rate is null then v_krw_known:=false;
          elsif v_valid and v_krw_known then
            v_krw_cost:=v_krw_cost-v_trade.net_amount*v_rate;
          end if;
          continue;
        end if;
        v_status:='calculated';v_alloc:=null;v_krw_alloc:=null;
        if not v_valid then v_status:='source_review';
        elsif v_trade.quantity>v_qty or v_qty<=0 then v_status:='cost_review';
        elsif not v_known then
          v_status:=case when v_seen_mixed is null then 'cost_review'
            else 'order_unverified' end;
        else
          v_alloc:=v_cost*v_trade.quantity/v_qty;
          v_cost:=v_cost-v_alloc;
          if v_krw_known then
            v_krw_alloc:=v_krw_cost*v_trade.quantity/v_qty;
            v_krw_cost:=v_krw_cost-v_krw_alloc;
          end if;
        end if;
        v_issue_origin:=v_seen_mixed;
        if v_status<>'calculated' or v_trade.quantity>v_qty then
          v_known:=false;v_krw_known:=false;
        end if;
        v_qty:=v_qty-coalesce(v_trade.quantity,0);
        if abs(v_qty)<0.00000001 then
          v_qty:=0;v_cost:=0;v_krw_cost:=0;v_known:=true;v_krw_known:=true;v_seen_mixed:=null;
        end if;
        if v_date<v_start then continue;end if;
        v_count:=v_count+1;
        if v_status='calculated' then
          if v_trade.order_at is null then v_status:='partial_date';v_partial:=v_partial+1;
          else v_complete:=v_complete+1;end if;
        elsif v_status='order_unverified' then v_order:=v_order+1;v_carried_order:=v_carried_order+1;
        elsif v_status='cost_review' then v_cost_missing:=v_cost_missing+1;
        else v_source_missing:=v_source_missing+1;end if;
        v_latest_rate:=null;v_latest_day:=null;v_latest_source:=null;
        if v_trade.currency='USD' then
          select f.rate,f.rate_date,f.source into v_latest_rate,v_latest_day,v_latest_source
          from public.fx_rates f where f.base_currency='USD' and f.quote_currency='KRW'
            and f.rate_date<=v_today and f.rate>0
          order by f.rate_date desc,(f.source='kb_account_snapshot') desc nulls last,f.observed_at desc nulls last,f.source,f.rate desc limit 1;
        end if;
        v_items:=v_items||jsonb_build_array(jsonb_build_object(
          'transaction_id',v_trade.id,'source_transaction_id',v_trade.external_id,
          'symbol',v_security.symbol,'name',v_security.name,
          'trade_date',v_date,'ledger_date',(v_trade.trade_at at time zone 'Asia/Seoul')::date,
          'date_basis',case when v_trade.order_at is null then 'ledger_date_execution_unverified'
            else 'broker_order_date_no_intraday_time' end,
          'status',v_status,'issue_date',case when v_status='order_unverified' then v_issue_origin else null end,
          'issue',case when v_status='order_unverified' then 'prior_mixed_day_cost_basis_unresolved'
            when v_status='partial_date' then 'execution_date_unverified_ledger_only'
            when v_status='cost_review' then 'acquisition_or_transfer_cost_basis_unverified'
            when v_status='source_review' then 'source_cash_cost_or_quantity_mismatch' else null end,
          'issue_category',case when v_status='order_unverified' then 'carried_cost_uncertainty'
            when v_status='partial_date' then 'date_boundary_unverified'
            else v_status end,
          'missing_fields',case when v_status='order_unverified' then
              jsonb_build_array('prior_mixed_day_execution_order','remaining_cost_basis')
            when v_status='partial_date' then jsonb_build_array('execution_date')
            when v_status='cost_review' then jsonb_build_array('opening_quantity_or_acquisition_cost')
            when v_status='source_review' then jsonb_build_array('reconciled_gross_net_fee_tax')
            else '[]'::jsonb end,
          'affected_metrics',case when v_status='partial_date' then
              jsonb_build_array('execution_date_period_membership')
            when v_status='calculated' then '[]'::jsonb
            else jsonb_build_array('sale_allocated_cost','sale_realized_pnl','remaining_cost') end,
          'resolution_condition',case when v_status='order_unverified' then
              'official earlier fill order or proven invariant remaining cost'
            when v_status='partial_date' then 'official execution date linked to this trade'
            when v_status='cost_review' then 'independent opening quantity and acquisition cost'
            when v_status='source_review' then 'broker gross/cash/fee/tax reconciliation' else null end,
          'quantity',v_trade.quantity,'currency',v_trade.currency,
          'net_proceeds',case when v_valid then v_trade.net_amount else null end,
          'allocated_cost',v_alloc,
          'realized_local',case when v_alloc is not null then v_trade.net_amount-v_alloc else null end,
          'fee',v_trade.fee,'tax',v_trade.tax,
          'historical_krw_estimate',case when v_alloc is not null and
            v_krw_alloc is not null and v_rate is not null
            then v_trade.net_amount*v_rate-v_krw_alloc else null end,
          'historical_krw_allocated_cost',v_krw_alloc,
          'sale_fx_rate',v_rate,'sale_fx_date',v_rate_day,'sale_fx_source',v_rate_source,
          'reference_krw',case when v_alloc is not null and v_latest_rate is not null
            then (v_trade.net_amount-v_alloc)*v_latest_rate else null end,
          'reference_fx_rate',v_latest_rate,'reference_fx_date',v_latest_day,
          'reference_fx_source',v_latest_source));
      end loop;
    end loop;
  end loop;
  -- Aggregate fully closed periods separately; original per-sale evidence stays intact.
  if v_provider='kb_securities' and v_account=(select a.id from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active and a.provider='kb_securities'
    order by a.created_at limit 1) then
    v_period:=public.get_live_period_stock_pnl(case when p_period='TODAY' then '오늘' else p_period end);
    if (v_period->>'period_start')::date=v_start and (v_period->>'period_end')::date=v_today then
      select coalesce(jsonb_agg(x),'[]'::jsonb) into v_closed
      from jsonb_array_elements(v_period->'items') x
      where x->'closed_realized' is not null and x->'closed_realized'<>'null'::jsonb
      and (x->'closed_realized'->>'sale_count')::integer=(select count(*) from jsonb_array_elements(v_items) i
        where x->'aliases' ? (i->>'symbol'));
    end if;
  end if;
  return jsonb_build_object('ok',true,'period',p_period,'period_start',v_start,
    'period_end',v_today,'period_date_basis','broker_order_date_where_linked_else_provisional_ledger_date',
    'account_id',v_account,'account_provider',v_provider,
    'calculation_version','realized-sales-v4-closed-periods','cost_method','account_moving_average',
    'candidate_count',v_count,'ready_count',v_complete,'partial_count',v_partial,
    'order_unverified_count',v_order,'direct_order_count',v_direct_order,
    'carried_order_count',v_carried_order,'cost_review_count',v_cost_missing,
    'source_review_count',v_source_missing,'closed_cycles',v_closed,'items',v_items);
end $function$;
