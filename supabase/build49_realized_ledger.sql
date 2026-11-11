-- Independent, account-scoped moving-average realized P/L in the trade currency.
-- No synthetic trades, FX conversions, or zero-cost transfers are permitted.
create or replace function public.get_live_ledger_realized(p_period text default '1W')
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_user uuid := (select auth.uid());
  v_account uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start date;
  v_first date;
  v_security record;
  v_trade record;
  v_quantity numeric;
  v_cost numeric;
  v_alloc numeric;
  v_sell_qty numeric;
  v_period_sell_qty numeric;
  v_proceeds numeric;
  v_allocated numeric;
  v_official numeric;
  v_official_count integer;
  v_last_sell date;
  v_currency text;
  v_issue text;
  v_issue_at date;
  v_issue_qty numeric;
  v_buy_count integer;
  v_sell_count integer;
  v_crossed integer;
  v_now_qty numeric;
  v_rows jsonb := '[]'::jsonb;
  v_checked integer := 0;
  v_ready integer := 0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=v_user and a.mode='live' and a.provider='kb_securities' and a.is_active
    order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','ACCOUNT_NOT_FOUND'); end if;
  select min((t.trade_at at time zone 'Asia/Seoul')::date) into v_first
    from public.transactions t where t.account_id=v_account;
  v_start := case upper(coalesce(p_period,'1W'))
    when '오늘' then v_today when 'TODAY' then v_today
    when '1W' then v_today-6 when '1M' then (v_today-interval '1 month')::date
    when '3M' then (v_today-interval '3 months')::date
    when '6M' then (v_today-interval '6 months')::date
    when 'YTD' then make_date(extract(year from v_today)::int,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    else coalesce(v_first,v_today) end;
  for v_security in
    select s.id,s.symbol,s.name,s.market
    from public.securities s
    where exists(select 1 from public.transactions t
      where t.account_id=v_account and t.security_id=s.id and t.type='sell'
        and (t.trade_at at time zone 'Asia/Seoul')::date between v_start and v_today)
    order by s.name,s.id
  loop
    v_quantity:=0;v_cost:=0;v_sell_qty:=0;v_period_sell_qty:=0;v_proceeds:=0;v_allocated:=0;
    v_buy_count:=0;v_sell_count:=0;v_last_sell:=null;
    v_currency:=null;v_issue:=null;v_issue_at:=null;v_issue_qty:=null;
    -- Without an independently documented intraday order, a buy and sell on
    -- one date cannot be safely costed by their synthetic 03:00 timestamps.
    select count(*) into v_crossed from (
      select (t.trade_at at time zone 'Asia/Seoul')::date d
      from public.transactions t where t.account_id=v_account and t.security_id=v_security.id
        and t.type in ('buy','sell')
      group by 1 having count(distinct t.type)>1
    ) x;
    if v_crossed>0 then v_issue:='same_day_execution_order_unverified'; end if;
    for v_trade in
      select t.id,t.trade_at,t.type,t.quantity,t.net_amount,t.fee,t.tax,t.currency,
        t.provider_payload,t.source from public.transactions t
      where t.account_id=v_account and t.security_id=v_security.id
        and t.trade_at < (v_today+1)::timestamp at time zone 'Asia/Seoul'
      order by t.trade_at, t.id
    loop
      if v_currency is null and v_trade.type in ('buy','sell') then v_currency:=v_trade.currency;end if;
      if v_trade.type not in ('buy','sell') then
        if v_trade.type in ('split_in','split_out','transfer_in','transfer_out',
             'stock_split','reverse_split','merger','spinoff','symbol_change',
             'account_transfer','broker_transfer_in','broker_transfer_out') then
          v_issue:='corporate_action_or_transfer_cost_basis_required';v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;
        end if;
        continue;
      end if;
      if v_trade.type='sell' then
        v_sell_count:=v_sell_count+1;
        if (v_trade.trade_at at time zone 'Asia/Seoul')::date>=v_start then
          v_period_sell_qty:=v_period_sell_qty+coalesce(v_trade.quantity,0);
          v_last_sell:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;
        end if;
      end if;
      if v_issue is not null and v_issue_at is null then v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;end if;
      if v_trade.quantity is null or v_trade.quantity<=0 or v_trade.net_amount is null
        or v_trade.fee is null or v_trade.tax is null or v_trade.currency is distinct from v_currency
        or v_trade.source<>'api' or
        trim(replace(coalesce(v_trade.provider_payload->>'dl_amt',''),',','')) !~ '^[0-9]+(\.[0-9]+)?$' then
        if v_issue is null then v_issue:='trade_amount_or_cost_missing';v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;end if;
        continue;
      end if;
      if abs(abs(v_trade.net_amount) -
        (replace(trim(v_trade.provider_payload->>'dl_amt'),',','')::numeric+
         case when v_trade.type='buy' then v_trade.fee+v_trade.tax
              else -v_trade.fee-v_trade.tax end))>0.02 then
        if v_issue is null then v_issue:='source_amount_basis_conflict';v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;end if;
        continue;
      end if;
      if v_trade.type='buy' then
        v_buy_count:=v_buy_count+1;
        if v_trade.net_amount>=0 then
          if v_issue is null then v_issue:='buy_cash_sign_conflict';v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;end if;
          continue;
        end if;
        v_quantity:=v_quantity+v_trade.quantity;
        v_cost:=v_cost-v_trade.net_amount; -- the debit already includes the buy fee
      else
        if v_trade.net_amount<0 or v_quantity<v_trade.quantity then
          if v_issue is null then
            v_issue:='missing_opening_buy_or_position_event';
            v_issue_at:=(v_trade.trade_at at time zone 'Asia/Seoul')::date;
            v_issue_qty:=greatest(v_trade.quantity-v_quantity,0);
          end if;
          continue;
        end if;
        v_alloc:=v_cost*v_trade.quantity/v_quantity;
        v_cost:=v_cost-v_alloc;v_quantity:=v_quantity-v_trade.quantity;
        if abs(v_quantity)<0.00000001 then v_quantity:=0;v_cost:=0;end if;
        if (v_trade.trade_at at time zone 'Asia/Seoul')::date>=v_start then
          v_sell_qty:=v_sell_qty+v_trade.quantity;
          v_proceeds:=v_proceeds+v_trade.net_amount; -- sell fee and tax already deducted
          v_allocated:=v_allocated+v_alloc;
        end if;
      end if;
    end loop;
    if v_period_sell_qty=0 then continue;end if;
    -- Position evidence is an independent check; do not silently promote a
    -- simulated ledger to verified if current quantity disagrees.
    select e.effective_quantity into v_now_qty from public.kb_balance_position_evidence e
      where e.account_id=v_account and e.symbol=v_security.symbol
      order by e.observed_at desc limit 1;
    if v_now_qty is null then
      select h.quantity into v_now_qty from public.holdings h
        where h.account_id=v_account and h.security_id=v_security.id limit 1;
    end if;
    if v_issue is null and abs(v_quantity-coalesce(v_now_qty,0))>0.000001 then
      v_issue:='ledger_current_position_mismatch';v_issue_at:=v_last_sell;
      v_issue_qty:=v_quantity-coalesce(v_now_qty,0);
    end if;
    select coalesce(sum(r.realized_pnl),0),count(*) into v_official,v_official_count
      from public.realized_pnl_events r
      where r.account_id=v_account and r.security_id=v_security.id
        and r.realized_date between v_start and v_today;
    v_checked:=v_checked+1;if v_issue is null then v_ready:=v_ready+1;end if;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object(
      'symbol',v_security.symbol,'name',v_security.name,'market',v_security.market,
      'currency',v_currency,'method','account_moving_average_trade_currency',
      'sell_quantity',v_period_sell_qty,'buy_events_examined',v_buy_count,
      'sell_events_examined',v_sell_count,'last_sell',v_last_sell,
      'allocated_cost',case when v_issue is null then v_allocated else null end,
      'net_proceeds',case when v_issue is null then v_proceeds else null end,
      'realized_local',case when v_issue is null then v_proceeds-v_allocated else null end,
      'buy_fees_in_cost',true,'sell_fees_tax_in_net_proceeds',true,
      'krw_conversion','unavailable_trade_fx',
      'status',case when v_issue is null then 'ledger_calculated' else 'missing_evidence' end,
      'missing_code',v_issue,'missing_date',v_issue_at,'missing_quantity',v_issue_qty,
      'position_state',case when v_issue is not null then 'unverified'
        when v_quantity=0 then 'fully_closed' else 'partially_sold' end,
      'official_realized_pnl',case when v_official_count>0 then v_official else null end,
      'official_event_count',v_official_count));
  end loop;
  return jsonb_build_object('ok',true,'period',p_period,'period_start',v_start,
    'period_end',v_today,'account_scope','kb_securities_auto',
    'method','moving_average_usd_or_transaction_currency',
    'ready_count',v_ready,'candidate_count',v_checked,'items',v_rows);
end $fn$;
revoke all on function public.get_live_ledger_realized(text) from public,anon;
grant execute on function public.get_live_ledger_realized(text) to authenticated;
