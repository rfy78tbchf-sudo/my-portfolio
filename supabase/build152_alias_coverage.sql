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
  v_pending integer := 0;
  v_matches jsonb;
  v_match_qty numeric;
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
  -- Execution evidence is visible before cash-ledger settlement. Never post it
  -- into transactions or count a linked settled sale twice.
  for v_trade in
    select e.*,coalesce((select s.name from public.securities s
      where s.symbol=e.symbol and s.currency=e.currency order by s.id limit 1),e.symbol) display_name
    from public.kb_position_evidence e
    where e.account_id=v_account and e.active and e.source='SPQM2205'
      and e.event_type='sell' and e.quantity>0 and e.order_date between v_start and v_today
      and not exists(select 1 from public.transactions t
        where t.account_id=e.account_id and t.type='sell' and t.currency=e.currency
          and trim(t.provider_payload->>'stnd_is_cd')=e.asset_key
          and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
          and t.quantity=e.quantity and t.price=e.price)
    order by e.order_date,e.symbol,e.id
  loop
    v_count:=v_count+1;v_pending:=v_pending+1;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'transaction_id',null,'evidence_id',v_trade.id,'source_transaction_id',v_trade.source_key,
      'symbol',v_trade.symbol,'name',v_trade.display_name,'currency',v_trade.currency,
      'trade_date',v_trade.order_date,'settlement_date',v_trade.settlement_date,
      'ledger_date',null,'date_basis','broker_order_date_no_intraday_time',
      'status','settlement_pending','issue','execution_not_linked_to_cash_ledger',
      'quantity',v_trade.quantity,'net_proceeds',v_trade.gross_amount,
      'allocated_cost',null,'realized_local',null,'historical_krw_estimate',null,
      'missing_fields',jsonb_build_array('settled_ledger','allocated_acquisition_cost'),
      'resolution_condition','linked settlement ledger and verified acquisition cost'));
  end loop;
  -- Prefer an independently reconciled broker-reported domestic profit.
  -- Only a unique daily report with matching ledger quantity may replace rows.
  for v_trade in
    select r.*,s.symbol,s.name from public.realized_pnl_events r
    join public.securities s on s.id=r.security_id
    where r.account_id=v_account and r.source='api' and r.currency='KRW'
      and r.provider_event_id like 'KB:SSQM2442:%'
      and r.provider_payload->>'trd_dl_ccd'='01'
      and r.realized_date between v_start and v_today
      and to_char(r.realized_date,'YYYYMMDD')=r.provider_payload->>'trd_dt'
      and regexp_replace(r.provider_payload->>'shrt_is_cd','^A','')=s.symbol
      and r.quantity>0 and r.sell_amount>0 and r.buy_amount>0 and r.fee>=0 and r.tax>=0
      and r.sell_amount-r.buy_amount-r.fee-r.tax=r.realized_pnl
      and abs(r.sell_amount-r.quantity*r.sell_price)<=r.quantity/2
      and not exists(select 1 from public.realized_pnl_events d
        where d.account_id=r.account_id and d.security_id=r.security_id
          and d.realized_date=r.realized_date and d.provider_payload->>'trd_dl_ccd'='01' and d.id<>r.id)
  loop
    select coalesce(jsonb_agg(i),'[]'::jsonb),sum((i->>'quantity')::numeric)
      into v_matches,v_match_qty from jsonb_array_elements(v_items) i
      where i->>'symbol'=v_trade.symbol and i->>'currency'='KRW'
        and i->>'trade_date'=v_trade.realized_date::text;
    if jsonb_array_length(v_matches)>0 and v_match_qty<>v_trade.quantity then continue;end if;
    -- Avoid adding a second copy when the ledger date is later and order date is absent.
    if jsonb_array_length(v_matches)=0 and exists(select 1 from public.transactions t
      where t.account_id=v_account and t.security_id=v_trade.security_id and t.type='sell'
        and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date
          between v_trade.realized_date and v_trade.realized_date+7) then continue;end if;
    select coalesce(jsonb_agg(i),'[]'::jsonb) into v_items from jsonb_array_elements(v_items) i
      where not(i->>'symbol'=v_trade.symbol and i->>'currency'='KRW'
        and i->>'trade_date'=v_trade.realized_date::text);
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'symbol',v_trade.symbol,'name',v_trade.name,'currency','KRW',
      'trade_date',v_trade.realized_date,'quantity',v_trade.quantity,
      'transaction_id',null,'official_event_id',v_trade.id,'status','broker_official',
      'date_basis','broker_trade_date','source','KB SSQM2442',
      'net_proceeds',v_trade.sell_amount-v_trade.fee-v_trade.tax,
      'allocated_cost',v_trade.buy_amount,'realized_local',v_trade.realized_pnl,
      'historical_krw_estimate',v_trade.realized_pnl,'return_rate',v_trade.return_rate,
      'fee',v_trade.fee,'tax',v_trade.tax,'coverage_count',greatest(jsonb_array_length(v_matches),1)));
  end loop;
  select coalesce(sum(coalesce((i->>'coverage_count')::int,1)),0),
    count(*) filter(where i->>'status' in ('calculated','broker_official')),
    count(*) filter(where i->>'status'='source_review'),
    count(*) filter(where i->>'status'='cost_review'),
    count(*) filter(where i->>'status'='order_unverified')
    into v_count,v_complete,v_source_missing,v_cost_missing,v_order from jsonb_array_elements(v_items) i;
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
        where x->'aliases' ? (i->>'symbol'))
      and not exists(select 1 from jsonb_array_elements(v_items) i where x->'aliases' ? (i->>'symbol') and i->>'status'='broker_official');
    end if;
  end if;
  -- Order-independent period profit when the entire position starts and ends flat.
  -- Require complete active broker execution coverage, reconciled cash and an
  -- independently zero opening ledger quantity. Unsettled results stay provisional.
  if v_period is not null and (v_period->>'period_start')::date=v_start and (v_period->>'period_end')::date=v_today then
    select v_closed||coalesce(jsonb_agg(x||jsonb_build_object('closed_realized',
      jsonb_build_object('method','flat_to_flat_net_cash','realized_local',e.cash,
        'realized_krw',(x->>'pnl_krw')::numeric-coalesce((x->>'dividend_local')::numeric,0),
        'allocated_cost',e.buys,'sale_count',e.sales,'provisional_date_count',0,
        'provisional_settlement_count',(x->>'pending_count')::int))), '[]'::jsonb)
    into v_closed
    from jsonb_array_elements(v_period->'items') x
    cross join lateral (
      select count(*) trades,count(*) filter(where event_type='sell') sales,
        sum(case when event_type='buy' then -gross_amount else gross_amount end) cash,
        sum(gross_amount) filter(where event_type='buy') buys,
        sum(case when event_type='buy' then quantity else -quantity end) delta,
        bool_and(coalesce(quantity>0 and price>0 and gross_amount>0
          and evidence->>'occurrences'='1' and evidence->>'source'='SPQM2205'
          and evidence->>'order_date'=order_date::text
          and evidence->>'settlement_date'=settlement_date::text
          and settlement_date between order_date and order_date+10
          and case when evidence->>'trade_gross' ~ '^[0-9]+([.][0-9]+)?$' then
            abs((evidence->>'trade_gross')::numeric-quantity*price)<=0.02
            and case when event_type='buy' then gross_amount between (evidence->>'trade_gross')::numeric and (evidence->>'trade_gross')::numeric*1.02
              else gross_amount between (evidence->>'trade_gross')::numeric*0.98 and (evidence->>'trade_gross')::numeric end
            else false end,false)) valid
      from public.kb_position_evidence b
      where b.account_id=v_account and b.active and b.source='SPQM2205'
        and (x->'aliases' ? b.symbol) and b.currency='USD' and b.event_type in ('buy','sell')
        and b.order_date between v_start and v_today
    ) e
    where x->>'currency'='USD' and x->>'reason' is null
      and (x->>'start_quantity')::numeric=0 and (x->>'end_quantity')::numeric=0
      and (x->>'pending_count')::int>0 and coalesce((x->>'dividend_local')::numeric,0)=0
      and x->>'pnl_krw' is not null and e.valid and e.delta=0 and e.sales>0
      and e.trades=(x->>'trade_count')::int and e.cash=(x->>'trade_cash_local')::numeric
      and e.sales=(select count(*) from jsonb_array_elements(v_items) i where (x->'aliases' ? (i->>'symbol')))
      and not exists(select 1 from jsonb_array_elements(v_closed) c where c->>'symbol'=x->>'symbol')
      and 0=(select coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0)
        from public.transactions t join public.securities s on s.id=t.security_id
        where t.account_id=v_account and (x->'aliases' ? s.symbol)
          and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<v_start)
      and not exists(select 1 from public.transactions t join public.securities s on s.id=t.security_id
        where t.account_id=v_account and (x->'aliases' ? s.symbol) and t.type in ('buy','sell')
          and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date between v_start and v_today
          and not exists(select 1 from public.kb_position_evidence b
            where b.account_id=t.account_id and b.active and b.source='SPQM2205'
              and b.asset_key=trim(t.provider_payload->>'stnd_is_cd') and b.event_type=t.type
              and b.quantity=t.quantity and b.price=t.price
              and b.settlement_date=(t.trade_at at time zone 'Asia/Seoul')::date
              and b.order_date=(t.order_at at time zone 'Asia/Seoul')::date
              and b.gross_amount=abs(t.net_amount)));
  end if;
  return jsonb_build_object('ok',true,'period',p_period,'period_start',v_start,
    'period_end',v_today,'period_date_basis','broker_order_date_where_linked_else_provisional_ledger_date',
    'account_id',v_account,'account_provider',v_provider,
    'calculation_version','realized-sales-v8-alias-coverage','cost_method','account_moving_average',
    'pending_settlement_count',v_pending,'candidate_count',v_count,'ready_count',v_complete,'partial_count',v_partial,
    'order_unverified_count',v_order,'direct_order_count',v_direct_order,
    'carried_order_count',v_carried_order,'cost_review_count',v_cost_missing,
    'source_review_count',v_source_missing,'closed_cycles',v_closed,'items',v_items);
end $function$;

revoke all on function public.get_live_realized_sales(text,uuid) from public,anon;
grant execute on function public.get_live_realized_sales(text,uuid) to authenticated;
