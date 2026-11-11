-- An explicit input inventory for the automatic KB account. It does not
-- reverse-balance the latest NAV and call that an observed opening asset.
create or replace function public.get_live_one_month_input_coverage()
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_end date := (now() at time zone 'Asia/Seoul')::date;
  v_start date := ((now() at time zone 'Asia/Seoul')::date-interval '1 month')::date;
  v_first_nav date;
  v_last_nav date;
  v_first_position date;
  v_last_position date;
  v_cash_first date;
  v_cash_last date;
  v_flow_count integer;
  v_trade_count integer;
  v_order_count integer;
  v_settlement_count integer;
  v_price_needed integer;
  v_price_found integer;
  v_missing_symbols jsonb;
  v_fx_latest date;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select id into v_account from public.accounts a where a.user_id=(select auth.uid())
    and a.provider='kb_securities' and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','ACCOUNT_NOT_FOUND'); end if;
  select min(snapshot_date),max(snapshot_date) into v_first_nav,v_last_nav
    from public.daily_account_snapshots where account_id=v_account;
  select min(snapshot_date),max(snapshot_date) into v_first_position,v_last_position
    from public.daily_security_snapshots where account_id=v_account;
  select min(balance_date),max(balance_date) into v_cash_first,v_cash_last
    from public.account_observations where account_id=v_account;
  select count(*) into v_flow_count from public.cash_flows
    where account_id=v_account and (occurred_at at time zone 'Asia/Seoul')::date
      between v_start and v_end and type in ('deposit','withdrawal');
  select count(*),count(*) filter(where order_at is not null),
    count(*) filter(where settlement_at is not null)
    into v_trade_count,v_order_count,v_settlement_count
    from public.transactions where account_id=v_account and type in ('buy','sell')
      and (coalesce(order_at,trade_at) at time zone 'Asia/Seoul')::date
      between v_start and v_end;
  with needed as (
    select distinct security_id from public.holdings where account_id=v_account and quantity>0
    union
    select distinct security_id from public.transactions where account_id=v_account
      and type in ('buy','sell')
      and (coalesce(order_at,trade_at) at time zone 'Asia/Seoul')::date between v_start and v_end
  ), covered as (
    select n.security_id,s.symbol,exists(select 1 from public.daily_security_prices p
      where p.security_id=n.security_id and p.price_date between v_start-4 and v_start) priced
    from needed n join public.securities s on s.id=n.security_id
  ) select count(*),count(*) filter(where priced),
    coalesce(jsonb_agg(symbol order by symbol) filter(where not priced),'[]'::jsonb)
    into v_price_needed,v_price_found,v_missing_symbols from covered;
  select max(rate_date) into v_fx_latest from public.fx_rates where base_currency='USD'
    and quote_currency='KRW' and rate_date<=v_end;
  return jsonb_build_object('ok',true,'account_scope','kb_securities_auto',
    'period_start',v_start,'period_end',v_end,
    'opening_nav',jsonb_build_object('status',case when v_first_nav<=v_start then 'observed'
      else 'missing' end,'first_observed_date',v_first_nav),
    'opening_positions',jsonb_build_object('status',case when v_first_position<=v_start
      then 'observed' else 'reconstruction_unverified' end,'first_observed_date',v_first_position),
    'opening_cash',jsonb_build_object('status',case when v_cash_first<=v_start
      then 'observed' else 'missing' end,'first_observed_date',v_cash_first),
    'opening_prices',jsonb_build_object('status',case when v_price_found=v_price_needed
      then 'covered' else 'partial' end,'needed_symbols',v_price_needed,
      'priced_symbols',v_price_found,'missing_symbols',v_missing_symbols),
    'external_flows',jsonb_build_object('status','classification_and_reflection_review',
      'deposit_withdrawal_events',v_flow_count),
    'execution_settlement',jsonb_build_object('status',case when v_order_count=v_trade_count
      then 'order_dates_linked' else 'partial_order_dates' end,
      'trade_events',v_trade_count,'linked_order_dates',v_order_count,
      'linked_settlement_dates',v_settlement_count),
    'closing_nav',jsonb_build_object('status',case when v_last_nav=v_end then 'observed_today'
      when v_last_nav is not null then 'older_observation' else 'missing' end,
      'last_observed_date',v_last_nav),
    'fx',jsonb_build_object('status',case when v_fx_latest>=v_end-4 then 'recent_reference_available'
      else 'historical_coverage_review' end,'latest_rate_date',v_fx_latest,
      'policy','historical rate by transaction date; no fabricated conversion'));
end $fn$;
revoke all on function public.get_live_one_month_input_coverage() from public,anon;
grant execute on function public.get_live_one_month_input_coverage() to authenticated;
