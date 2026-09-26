-- Separately inspect a zero-net ledger span. A missing broker opening balance
-- is never upgraded to a verified closed-cycle P/L merely because net=0.
create or replace function public.get_live_realized_cycle_review(p_symbol text)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_security uuid;
  v_first date;
  v_last date;
  v_buys numeric;
  v_sells numeric;
  v_buy_cost numeric;
  v_sale_net numeric;
  v_bad integer;
  v_corporate integer;
  v_currency text;
  v_currency_count integer;
  v_months integer;
  v_incomplete integer;
  v_opening boolean;
  v_ending boolean;
  v_days jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if upper(trim(coalesce(p_symbol,''))) !~ '^[A-Z0-9.]{1,15}$'
    then raise exception 'invalid symbol'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.provider='kb_securities'
      and a.mode='live' and a.is_active order by a.created_at limit 1;
  select s.id into v_security from public.securities s
    where s.symbol=upper(trim(p_symbol)) and exists(select 1 from public.transactions t
      where t.account_id=v_account and t.security_id=s.id) order by s.id limit 1;
  if v_security is null then return jsonb_build_object('ok',false,'reason','NO_OWNER_TRADES'); end if;
  select min((coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date),
      max((coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date),
      coalesce(sum(t.quantity) filter(where t.type='buy'),0),
      coalesce(sum(t.quantity) filter(where t.type='sell'),0),
      coalesce(sum(-t.net_amount) filter(where t.type='buy'),0),
      coalesce(sum(t.net_amount) filter(where t.type='sell'),0),
      count(*) filter(where t.source<>'api' or t.quantity is null or t.quantity<=0
        or t.net_amount is null or t.fee is null or t.tax is null or
        trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',',''))
          !~ '^[0-9]+(\.[0-9]+)?$'),
      count(*) filter(where t.type not in ('buy','sell','dividend','fee','tax','interest')),
      min(t.currency) filter(where t.type in ('buy','sell')),
      count(distinct t.currency) filter(where t.type in ('buy','sell'))
    into v_first,v_last,v_buys,v_sells,v_buy_cost,v_sale_net,v_bad,v_corporate,
      v_currency,v_currency_count
    from public.transactions t where t.account_id=v_account and t.security_id=v_security;
  select count(*),count(*) filter(where m.completed_at is null or m.ledger_rows is null)
    into v_months,v_incomplete from public.kb_backfill_months m
    where m.user_id=(select auth.uid()) and m.month<=date_trunc('month',v_last)::date;
  select exists(select 1 from public.kb_balance_position_evidence e
    where e.account_id=v_account and e.symbol=upper(trim(p_symbol))
      and (e.observed_at at time zone 'Asia/Seoul')::date<v_first
      and e.effective_quantity=0) into v_opening;
  select exists(select 1 from public.kb_balance_position_evidence e
    where e.account_id=v_account and e.symbol=upper(trim(p_symbol))
      and (e.observed_at at time zone 'Asia/Seoul')::date>=v_last
      and e.effective_quantity=0) into v_ending;
  select coalesce(jsonb_agg(d.event_day order by d.event_day),'[]'::jsonb) into v_days from (
    select (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date event_day
    from public.transactions t where t.account_id=v_account and t.security_id=v_security
      and t.type in ('buy','sell') group by 1 having count(distinct t.type)>1
  ) d;
  return jsonb_build_object('ok',true,'symbol',upper(trim(p_symbol)),
    'account_scope','kb_securities_auto','first_order_or_ledger_date',v_first,
    'last_order_or_ledger_date',v_last,'buy_quantity',v_buys,'sell_quantity',v_sells,
    'buy_cost',v_buy_cost,'sell_net',v_sale_net,
    'ledger_net_quantity',v_buys-v_sells,'source_missing_count',v_bad,
    'corporate_or_transfer_event_count',v_corporate,
    'backfill_months',v_months,'backfill_incomplete_months',v_incomplete,
    'opening_zero_verified',v_opening,'ending_zero_verified',v_ending,
    'mixed_days',v_days,'candidate_currency',case when v_currency_count=1 then v_currency else null end,
    'candidate_cash_difference',case when v_bad=0 and v_corporate=0
      and v_buys=v_sells and v_incomplete=0 and v_currency_count=1
      then v_sale_net-v_buy_cost else null end,
    'status',case when v_bad=0 and v_corporate=0 and v_buys=v_sells and v_currency_count=1
      and v_incomplete=0 and v_opening and v_ending then 'closed_cycle_verified'
      when v_buys=v_sells then 'opening_or_ending_balance_unverified'
      else 'incomplete_cycle' end);
end $fn$;
revoke all on function public.get_live_realized_cycle_review(text) from public,anon;
grant execute on function public.get_live_realized_cycle_review(text) to authenticated;
