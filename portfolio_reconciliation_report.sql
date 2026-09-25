-- A read-only reconciliation report. Broker positions remain authoritative;
-- unmatched ledger quantities are evidence gaps, not automatic balance edits.
create or replace function public.get_live_reconciliation_report()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_account uuid;
  v_snap record;
  v_items jsonb;
  v_total integer;
  v_verified integer;
  v_missing integer;
  v_pending integer;
  v_mismatch integer;
  v_duplicates integer;
  v_missing_fx integer;
  v_unknown_sales integer;
  v_pnl_mismatch integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','실제 계좌 없음'); end if;
  select snapshot_at,snapshot_date,cash,total_assets,securities_value
    into v_snap from public.daily_account_snapshots
    where account_id=v_account order by snapshot_date desc limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','실제 계좌 잔고 기록 없음'); end if;

  with broker as (
    select h.security_id,s.symbol,s.name,h.quantity actual_qty,h.as_of
    from public.holdings h join public.securities s on s.id=h.security_id
    where h.account_id=v_account and h.quantity>0
  ), ledger as (
    select t.security_id,
      count(*) filter (where t.type in ('buy','sell') and
        (t.trade_at at time zone 'Asia/Seoul')::date<v_snap.snapshot_date) prior_trades,
      coalesce(sum(case
        when t.type='buy' and (t.trade_at at time zone 'Asia/Seoul')::date<v_snap.snapshot_date then t.quantity
        when t.type='sell' and (t.trade_at at time zone 'Asia/Seoul')::date<v_snap.snapshot_date then -t.quantity
        else 0 end),0) prior_quantity,
      count(*) filter (where t.type in ('buy','sell') and
        (t.trade_at at time zone 'Asia/Seoul')::date=v_snap.snapshot_date) same_day_trades,
      min(t.trade_at) filter (where t.type in ('buy','sell')) first_trade,
      max(t.trade_at) filter (where t.type in ('buy','sell')) last_trade
    from public.transactions t where t.account_id=v_account
      and t.security_id is not null group by t.security_id
  ), diagnostic as (
    select b.*,coalesce(l.prior_trades,0) prior_trades,
      coalesce(l.same_day_trades,0) same_day_trades,
      coalesce(l.prior_quantity,0) prior_quantity,
      l.first_trade,l.last_trade,
      case when coalesce(l.same_day_trades,0)>0 then 'same_day_pending'
        when coalesce(l.prior_trades,0)=0 then 'ledger_missing'
        when abs(b.actual_qty-l.prior_quantity)>.000001 then 'quantity_unmatched'
        else 'quantity_matched' end state
    from broker b left join ledger l using(security_id)
  )
  select count(*),count(*) filter(where state='quantity_matched'),
    count(*) filter(where state='ledger_missing'),
    count(*) filter(where state='same_day_pending'),
    count(*) filter(where state='quantity_unmatched'),
    coalesce(jsonb_agg(jsonb_build_object(
      'symbol',symbol,'name',name,'security_id',security_id,
      'actual_qty',actual_qty,'ledger_qty_before_balance_day',prior_quantity,
      'prior_trade_count',prior_trades,'same_day_trade_count',same_day_trades,
      'first_trade',first_trade,'last_trade',last_trade,'state',state)
      order by case state when 'quantity_unmatched' then 0 when 'ledger_missing' then 1
        when 'same_day_pending' then 2 else 3 end,symbol),'[]'::jsonb)
    into v_total,v_verified,v_missing,v_pending,v_mismatch,v_items
  from diagnostic;

  select count(*) into v_duplicates from (
    select external_id from public.transactions
    where account_id=v_account group by external_id having count(*)>1
  ) d;
  select count(*) into v_missing_fx from public.transactions
    where account_id=v_account and currency<>'KRW' and fx_rate is null
      and type in ('buy','sell');
  select count(*) into v_unknown_sales from public.transactions
    where account_id=v_account and type='sell' and security_id is null;
  with snapshots as (
    select snapshot_date,total_assets,external_flow,
      lag(total_assets) over(order by snapshot_date) prev_assets
      from public.daily_account_snapshots where account_id=v_account
  ) select count(*) into v_pnl_mismatch
    from snapshots s join public.portfolio_performance p
      on p.account_id=v_account and p.performance_date=s.snapshot_date
    where s.prev_assets is not null and
      p.daily_pnl is distinct from s.total_assets-s.prev_assets-s.external_flow;
  return jsonb_build_object('ok',true,'checked_at',now(),
    'balance_date',v_snap.snapshot_date,'balance_at',v_snap.snapshot_at,
    'broker_cash_krw',v_snap.cash,'broker_total_assets_krw',v_snap.total_assets,
    'broker_securities_krw',v_snap.securities_value,
    'quantity_total',v_total,'quantity_matched',v_verified,
    'quantity_ledger_missing',v_missing,'quantity_same_day_pending',v_pending,
    'quantity_unmatched',v_mismatch,
    'duplicate_trade_ids',v_duplicates,'missing_historical_fx_trades',v_missing_fx,
    'unmapped_sales',v_unknown_sales,'performance_identity_errors',v_pnl_mismatch,
    'cash_reconstructable',false,'cash_reason',
      '계좌 개설 시점의 확정 현금 잔액과 모든 입출금·환전 결제 기록이 없어 원장 현금 재구성은 검증되지 않았습니다.',
    'items',v_items);
end $$;
revoke all on function public.get_live_reconciliation_report() from public,anon;
grant execute on function public.get_live_reconciliation_report() to authenticated;
