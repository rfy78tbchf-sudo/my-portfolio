-- Anchor the cash ledger to the automatic KB account explicitly. This must
-- remain independent of the ISA's manual balance observations.
create or replace function public.get_live_cash_accounting(p_date date default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare
  v_account uuid; v_date date:=coalesce(p_date,timezone('Asia/Seoul',now())::date);
  v_anchor_date date; v_anchor_cash numeric; v_anchor_fx jsonb;
  v_first date; v_last date; v_krw_delta numeric; v_usd_delta numeric;
  v_events int; v_unclassified int; v_interval_unknown int; v_fx_pairs int; v_source_dates int;
  v_balance numeric; v_quality text; v_first_observed date;
  v_bridge_errors int; v_largest_bridge_gap numeric;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    and a.provider='kb_securities'
  order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_LIVE_ACCOUNT'); end if;
  select min(e.event_date),max(e.event_date) into v_first,v_last
  from public.live_cash_ledger_events e where e.account_id=v_account;
  select min(o.balance_date) into v_first_observed from public.account_observations o
  where o.account_id=v_account and o.cash_krw is not null;
  select o.balance_date,o.cash_krw,o.foreign_cash
    into v_anchor_date,v_anchor_cash,v_anchor_fx
  from public.account_observations o
  where o.account_id=v_account and o.balance_date>=v_date and o.cash_krw is not null
  order by o.balance_date asc,o.fetched_at desc limit 1;
  select count(*),count(distinct e.event_date),
    count(*) filter(where e.evidence='source_foreign_amount_and_rate')
  into v_events,v_source_dates,v_fx_pairs
  from public.live_cash_ledger_events e
  where e.account_id=v_account and e.event_date<=v_date;
  select coalesce(sum(e.amount) filter(where e.currency='KRW'),0),
    coalesce(sum(e.amount) filter(where e.currency='USD'),0)
    into v_krw_delta,v_usd_delta
  from public.live_cash_ledger_events e
  where e.account_id=v_account and e.event_date>v_date and e.event_date<=v_anchor_date;
  select count(*) into v_unclassified from public.transactions t
  where t.account_id=v_account and t.type='other'
    and (t.trade_at at time zone 'Asia/Seoul')::date<=v_date
    and not exists (select 1 from public.live_cash_ledger_events e where e.transaction_id=t.id);
  select count(*) into v_interval_unknown from public.transactions t
  where t.account_id=v_account and t.type='other'
    and (t.trade_at at time zone 'Asia/Seoul')::date>v_date
    and (t.trade_at at time zone 'Asia/Seoul')::date<=v_anchor_date
    and not exists (select 1 from public.live_cash_ledger_events e where e.transaction_id=t.id);
  with observations as (
    select distinct on (o.balance_date) o.balance_date,o.cash_krw
    from public.account_observations o
    where o.account_id=v_account and o.cash_krw is not null
      and o.balance_date between v_date and v_anchor_date
    order by o.balance_date,o.fetched_at desc
  ), intervals as (
    select o.*,lag(o.balance_date) over(order by o.balance_date) previous_date,
      lag(o.cash_krw) over(order by o.balance_date) previous_balance from observations o
  ), gaps as (
    select abs(i.cash_krw-i.previous_balance-coalesce((
      select sum(e.amount) from public.live_cash_ledger_events e
      where e.account_id=v_account and e.currency='KRW'
        and e.event_date>i.previous_date and e.event_date<=i.balance_date),0)) gap
    from intervals i where i.previous_date is not null
  ) select count(*) filter(where gap>1),max(gap) into v_bridge_errors,v_largest_bridge_gap from gaps;
  if v_date=v_anchor_date then v_balance:=v_anchor_cash;v_quality:='confirmed_cash_balance';
  elsif v_date>=v_first and v_anchor_date>v_date then
    v_balance:=v_anchor_cash-v_krw_delta;
    v_quality:=case when v_interval_unknown>0 or v_date<v_first_observed
      or coalesce(v_bridge_errors,0)>0 then 'estimated_cash_balance'
      else 'reconstructed_cash_balance' end;
  else v_balance:=null;v_quality:='unresolved_cash_balance'; end if;
  return jsonb_build_object('ok',true,'as_of',v_date,'source','KB SWQA2301 + KB account observation',
    'first_event_date',v_first,'last_event_date',v_last,'event_count',v_events,
    'observed_event_dates',v_source_dates,'excluded_ambiguous_event_count',v_unclassified,
    'unknown_events_between_target_and_anchor',v_interval_unknown,
    'observed_cash_bridge_errors',v_bridge_errors,'largest_cash_bridge_gap_krw',v_largest_bridge_gap,
    'fx_source_pair_count',v_fx_pairs,
    'krw',jsonb_build_object('balance',v_balance,'status',v_quality,'anchor_date',v_anchor_date,
      'anchor_balance',v_anchor_cash,'post_date_events_to_anchor',v_krw_delta),
    'usd',jsonb_build_object('balance',null,'status','unresolved_cash_balance',
      'reason','KB integrated balance provides KRW equivalent, not original USD amount',
      'post_date_events_to_krw_anchor',v_usd_delta,
      'last_foreign_krw_equivalent',v_anchor_fx->'KRW_equivalent'),
    'limitations',jsonb_build_array('event dates are broker ledger dates, not proven account reflected dates',
      'unsettled cash, unidentified other events, and past corrections may change reconstructed balance'));
end $fn$;

revoke all on public.live_cash_ledger_events from public,anon;
grant select on public.live_cash_ledger_events to authenticated;
revoke all on function public.get_live_cash_accounting(date) from public,anon;
grant execute on function public.get_live_cash_accounting(date) to authenticated;
