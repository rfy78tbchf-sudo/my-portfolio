-- Reconcile in both directions. A positive or negative ledger position absent
-- from the latest broker holdings is an evidence gap, not an owned asset.
create or replace function public.get_live_reconciliation_report()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  v_account uuid;
  v_date date;
  v_snap record;
  v_items jsonb;
  v_total int;v_matched int;v_missing int;v_pending int;v_mismatch int;
  v_duplicates int;v_missing_fx int;v_unknown int;v_identity int;
  v_ledger_only int;v_ledger_only_items jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  select snapshot_date,snapshot_at,cash,total_assets,securities_value into v_snap
    from public.daily_account_snapshots where account_id=v_account
    order by snapshot_date desc limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','실제 계좌 잔고 기록 없음'); end if;
  v_date:=v_snap.snapshot_date;

  with raw_codes as materialized (
    select s.id,s.symbol,s.currency,
      case when s.symbol ~ '^A[0-9][0-9A-Z]{5}$' and s.currency='KRW'
        then substr(s.symbol,2) else s.symbol end normalized,
      coalesce(s.isin,(select nullif(trim(t.provider_payload->>'stnd_is_cd'),'')
        from public.transactions t where t.security_id=s.id
          and trim(t.provider_payload->>'stnd_is_cd') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
        order by t.trade_at desc limit 1)) isin
      from public.securities s
  ), identity as materialized (
    select r.id,coalesce(r.isin,
      (select x.isin from raw_codes x where x.normalized=r.normalized
        and x.currency=r.currency and x.isin is not null
        order by case when x.id=r.id then 0 else 1 end,x.id limit 1),
      r.currency||':'||r.normalized) asset_key from raw_codes r
  ), broker as (
    select h.security_id,i.asset_key,s.symbol,s.name,h.quantity actual_qty
    from public.holdings h join public.securities s on s.id=h.security_id
      join identity i on i.id=s.id
    where h.account_id=v_account and h.quantity>0
  ), activity as (
    select i.asset_key,t.trade_at,t.external_id,t.type,t.quantity,
      t.provider_payload->>'smry_nm' description,
      (t.trade_at at time zone 'Asia/Seoul')::date d,
      case when t.type in ('buy','transfer_in','split_in','corporate_in') then t.quantity
        when t.type in ('sell','transfer_out','split_out','corporate_out') then -t.quantity
        else 0 end change
    from public.transactions t join identity i on i.id=t.security_id
    where t.account_id=v_account and t.quantity>0 and t.type in
      ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out')
  ), ledger as (
    select asset_key,count(*) filter(where d<v_date) prior_trades,
      count(*) filter(where d=v_date) same_day_trades,
      coalesce(sum(change) filter(where d<v_date),0) prior_quantity,
      coalesce(sum(change) filter(where d<=v_date),0) through_quantity,
      min(d) first_trade_date,max(d) last_trade_date,
      jsonb_agg(jsonb_build_object('date',d,'type',type,'quantity',quantity,'external_id',external_id,'description',description)
        order by trade_at desc,external_id desc) filter(where d>=v_date-7 and d<=v_date) recent_events
    from activity group by asset_key
  ), changes as (
    select ds.security_id,ds.snapshot_date,ds.quantity,
      lag(ds.quantity) over(partition by ds.security_id order by ds.snapshot_date) previous_qty
      from public.daily_security_snapshots ds where ds.account_id=v_account
  ), observations as (
    -- KB activity day can be settlement day, while holdings are intraday.
    -- The first missing-trade day cannot be inferred from these four snapshots.
    -- Report the last *observed balance change* as evidence, never mislabel it.
    select b.asset_key,max(c.snapshot_date) filter(where c.previous_qty is not null
      and abs(c.quantity-c.previous_qty)>0.000001) last_balance_change_date
    from broker b left join changes c on c.security_id=b.security_id
    group by b.asset_key
  ), diag as (
    select b.*,coalesce(l.prior_quantity,0) prior_quantity,
      coalesce(l.through_quantity,0) through_quantity,
      coalesce(l.prior_trades,0) prior_trades,coalesce(l.same_day_trades,0) same_day_trades,
      l.first_trade_date,l.last_trade_date,l.recent_events,o.last_balance_change_date,
      case when abs(b.actual_qty-coalesce(l.prior_quantity,0))<=0.000001
             or abs(b.actual_qty-coalesce(l.through_quantity,0))<=0.000001
        then 'quantity_matched'
        when coalesce(l.prior_trades,0)=0 and coalesce(l.same_day_trades,0)=0
          then 'ledger_missing'
        when coalesce(l.same_day_trades,0)>0 then 'same_day_pending'
        else 'quantity_unmatched' end state
    from broker b left join ledger l using(asset_key)
      left join observations o using(asset_key)
  ) select count(*),count(*) filter(where state='quantity_matched'),
    count(*) filter(where state='ledger_missing'),
    count(*) filter(where state='same_day_pending'),
    count(*) filter(where state='quantity_unmatched'),
    coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,
      'security_id',security_id,'asset_key',asset_key,'actual_qty',actual_qty,
      'ledger_qty_before_balance_day',prior_quantity,'ledger_qty_through_balance_day',through_quantity,
      'difference_qty',actual_qty-through_quantity,'first_unmatched_date',null,
      'last_observed_balance_change_date',last_balance_change_date,
      'first_trade',first_trade_date,'last_trade',last_trade_date,
      'prior_trade_count',prior_trades,'same_day_trade_count',same_day_trades,
      'recent_events',coalesce(recent_events,'[]'::jsonb),'state',state)
      order by case state when 'quantity_unmatched' then 0 when 'ledger_missing' then 1
        when 'same_day_pending' then 2 else 3 end,symbol),'[]'::jsonb)
    into v_total,v_matched,v_missing,v_pending,v_mismatch,v_items from diag;
  with raw_codes as materialized (
    select s.id,s.symbol,s.currency,
      case when s.symbol ~ '^A[0-9][0-9A-Z]{5}$' and s.currency='KRW'
        then substr(s.symbol,2) else s.symbol end normalized,
      coalesce(s.isin,(select nullif(trim(t.provider_payload->>'stnd_is_cd'),'')
        from public.transactions t where t.security_id=s.id
          and trim(t.provider_payload->>'stnd_is_cd') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
        order by t.trade_at desc limit 1)) isin
    from public.securities s
  ), identity as materialized (
    select r.id,coalesce(r.isin,
      (select x.isin from raw_codes x where x.normalized=r.normalized
        and x.currency=r.currency and x.isin is not null
        order by case when x.id=r.id then 0 else 1 end,x.id limit 1),
      r.currency||':'||r.normalized) asset_key from raw_codes r
  ), broker as (
    select distinct i.asset_key from public.holdings h
      join identity i on i.id=h.security_id
    where h.account_id=v_account and h.quantity>0
  ), activity as (
    select i.asset_key,t.security_id,s.symbol,s.name,t.trade_at,t.external_id,
      t.type,t.quantity,t.provider_payload->>'smry_nm' description,
      (t.trade_at at time zone 'Asia/Seoul')::date d,
      case when t.type in ('buy','transfer_in','split_in','corporate_in') then t.quantity
        else -t.quantity end change
    from public.transactions t join identity i on i.id=t.security_id
      join public.securities s on s.id=t.security_id
    where t.account_id=v_account and t.quantity>0 and t.type in
      ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out')
  ), ledger as (
    select asset_key,(array_agg(security_id order by trade_at desc))[1] security_id,
      (array_agg(symbol order by trade_at desc))[1] symbol,
      (array_agg(name order by trade_at desc))[1] name,
      count(*) filter(where d<v_date) prior_trades,
      count(*) filter(where d=v_date) same_day_trades,
      coalesce(sum(change) filter(where d<v_date),0) prior_quantity,
      coalesce(sum(change) filter(where d<=v_date),0) through_quantity,
      min(d) first_trade_date,max(d) last_trade_date,
      jsonb_agg(jsonb_build_object('date',d,'type',type,'quantity',quantity,
        'external_id',external_id,'description',description)
        order by trade_at desc,external_id desc)
        filter(where d between v_date-7 and v_date) recent_events
    from activity where d<=v_date group by asset_key
  ), orphan as (
    select l.* from ledger l left join broker b using(asset_key)
      where b.asset_key is null and abs(l.through_quantity)>.000001
  ) select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'symbol',symbol,'name',name,'security_id',security_id,'asset_key',asset_key,
      'actual_qty',0,'ledger_qty_before_balance_day',prior_quantity,
      'ledger_qty_through_balance_day',through_quantity,'difference_qty',-through_quantity,
      'first_unmatched_date',null,'first_trade',first_trade_date,'last_trade',last_trade_date,
      'prior_trade_count',prior_trades,'same_day_trade_count',same_day_trades,
      'recent_events',coalesce(recent_events,'[]'::jsonb),'state','ledger_only')
      order by symbol),'[]'::jsonb)
    into v_ledger_only,v_ledger_only_items from orphan;
  v_total:=v_total+v_ledger_only;
  v_items:=v_ledger_only_items||v_items;
  select count(*) into v_duplicates from (
    select external_id from public.transactions where account_id=v_account
      group by external_id having count(*)>1) d;
  select count(*) into v_missing_fx from public.transactions t
    where t.account_id=v_account and t.currency='USD' and
      (t.fx_rate is null or t.fx_rate not between 500 and 3000)
      and t.type in ('buy','sell');
  select count(*) into v_unknown from public.transactions t
    where t.account_id=v_account and t.type='sell' and t.security_id is null;
  select count(*) into v_identity from (
    with x as (select s.snapshot_date,s.total_assets,s.external_flow,
      lag(s.total_assets) over(order by s.snapshot_date) previous_assets
      from public.daily_account_snapshots s where s.account_id=v_account)
    select 1 from x join public.portfolio_performance p
      on p.account_id=v_account and p.performance_date=x.snapshot_date
    where x.previous_assets is not null and
      p.daily_pnl is distinct from x.total_assets-x.previous_assets-x.external_flow
  ) z;
  return jsonb_build_object('ok',true,'checked_at',now(),'balance_date',v_date,
    'balance_at',v_snap.snapshot_at,'broker_cash_krw',v_snap.cash,
    'broker_total_assets_krw',v_snap.total_assets,
    'broker_securities_krw',v_snap.securities_value,
    'quantity_total',v_total,'quantity_matched',v_matched,
    'quantity_ledger_missing',v_missing,'quantity_same_day_pending',v_pending,
    'quantity_unmatched',v_mismatch,'duplicate_trade_ids',v_duplicates,
    'quantity_ledger_only',v_ledger_only,
    'missing_historical_fx_trades',v_missing_fx,'unmapped_sales',v_unknown,
    'performance_identity_errors',v_identity,'cash_reconstructable',false,
    'cash_reason','초기 현금잔고와 모든 결제시점이 검증되지 않아 이전 현금은 재구성 중입니다.',
    'items',v_items);
end $$;
revoke all on function public.get_live_reconciliation_report() from public,anon;
grant execute on function public.get_live_reconciliation_report() to authenticated;
