-- One owner-scoped allocation engine for each sell. The legacy symbol report
-- below becomes a projection of this engine, never another cost calculation.
create or replace function public.get_live_realized_sales(
  p_period text default '1M', p_account uuid default null)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
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
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_complete integer := 0;
  v_partial integer := 0;
  v_order integer := 0;
  v_cost_missing integer := 0;
  v_source_missing integer := 0;
  v_seen_mixed date;
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
        count(*) filter(where t.type not in ('buy','sell')) other_events
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
        for v_trade in
          select t.* from public.transactions t
          where t.account_id=v_account and t.security_id=v_security.id and t.type='sell'
            and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date=v_day.d
          order by t.id
        loop
          if v_day.d between v_start and v_today then
            v_count:=v_count+1;v_order:=v_order+1;
            v_items:=v_items||jsonb_build_array(jsonb_build_object(
              'transaction_id',v_trade.id,'symbol',v_security.symbol,'name',v_security.name,
              'trade_date',v_day.d,'ledger_date',(v_trade.trade_at at time zone 'Asia/Seoul')::date,
              'date_basis',case when v_trade.order_at is null then 'ledger_date_execution_unverified'
                else 'broker_order_date_no_intraday_time' end,
              'status','order_unverified','issue_date',v_day.d,
              'issue','same_day_buy_sell_execution_order',
              'quantity',v_trade.quantity,'currency',v_trade.currency,
              'net_proceeds',v_trade.net_amount,'allocated_cost',null,
              'realized_local',null,'fee',v_trade.fee,'tax',v_trade.tax));
          end if;
        end loop;
        v_qty:=v_qty+v_day.net_quantity;
        if v_qty=0 then v_cost:=0;v_krw_cost:=0;v_known:=true;v_krw_known:=true;end if;
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
            and f.quote_currency='KRW' and f.rate_date between v_date-4 and v_date
            and f.rate>0 order by f.rate_date desc,f.observed_at desc limit 1;
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
        elsif v_status='order_unverified' then v_order:=v_order+1;
        elsif v_status='cost_review' then v_cost_missing:=v_cost_missing+1;
        else v_source_missing:=v_source_missing+1;end if;
        v_latest_rate:=null;v_latest_day:=null;v_latest_source:=null;
        if v_trade.currency='USD' then
          select f.rate,f.rate_date,f.source into v_latest_rate,v_latest_day,v_latest_source
          from public.fx_rates f where f.base_currency='USD' and f.quote_currency='KRW'
            and f.rate_date<=v_today and f.rate>0
          order by f.rate_date desc,f.observed_at desc limit 1;
        end if;
        v_items:=v_items||jsonb_build_array(jsonb_build_object(
          'transaction_id',v_trade.id,'symbol',v_security.symbol,'name',v_security.name,
          'trade_date',v_date,'ledger_date',(v_trade.trade_at at time zone 'Asia/Seoul')::date,
          'date_basis',case when v_trade.order_at is null then 'ledger_date_execution_unverified'
            else 'broker_order_date_no_intraday_time' end,
          'status',v_status,'issue_date',case when v_status='order_unverified' then v_seen_mixed else null end,
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
  return jsonb_build_object('ok',true,'period',p_period,'period_start',v_start,
    'period_end',v_today,'period_date_basis','broker_order_date_where_linked_else_provisional_ledger_date',
    'account_id',v_account,'account_provider',v_provider,
    'calculation_version','realized-sales-v2','cost_method','account_moving_average',
    'candidate_count',v_count,'ready_count',v_complete,'partial_count',v_partial,
    'order_unverified_count',v_order,'cost_review_count',v_cost_missing,
    'source_review_count',v_source_missing,'items',v_items);
end $fn$;
revoke all on function public.get_live_realized_sales(text,uuid) from public,anon;
grant execute on function public.get_live_realized_sales(text,uuid) to authenticated;

create or replace function public.get_live_ledger_realized(p_period text default '1W')
returns jsonb language sql stable security invoker set search_path to '' as $fn$
  with source as (select public.get_live_realized_sales(p_period,null) j),
  grouped as (
    select x->>'symbol' symbol,max(x->>'name') name,max(x->>'currency') currency,
      count(*) sells,sum((x->>'quantity')::numeric) quantity,
      count(*) filter(where x->>'status' in ('calculated','partial_date')) ready,
      sum((x->>'net_proceeds')::numeric) filter(where x->>'status' in ('calculated','partial_date')) proceeds,
      sum((x->>'allocated_cost')::numeric) filter(where x->>'status' in ('calculated','partial_date')) cost,
      sum((x->>'realized_local')::numeric) filter(where x->>'status' in ('calculated','partial_date')) pnl,
      max(x->>'trade_date') last_sell,
      jsonb_agg(distinct x->>'status') states
    from source,lateral jsonb_array_elements(coalesce(j->'items','[]'::jsonb)) x
    group by x->>'symbol')
  select (select j from source) || jsonb_build_object('items',coalesce(
    (select jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,'currency',currency,
      'sell_quantity',quantity,'sell_count',sells,'ready_sale_count',ready,
      'allocated_cost',cost,'net_proceeds',proceeds,'realized_local',pnl,
      'last_sell',last_sell,'status',case when ready=sells then 'ledger_calculated'
        else 'partially_calculated' end,'states',states,
      'method','account_moving_average_trade_currency','krw_conversion','separate_sale_fx_evidence')
      order by symbol) from grouped),'[]'::jsonb))
$fn$;
revoke all on function public.get_live_ledger_realized(text) from public,anon;
grant execute on function public.get_live_ledger_realized(text) to authenticated;
