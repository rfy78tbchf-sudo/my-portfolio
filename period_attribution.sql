-- Return only defensible per-security contributions. Any gap to the account's
-- flow-adjusted P&L stays explicitly unallocated; no invented trade P&L.
create or replace function public.get_live_period_attribution(p_period text default '1M')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_summary jsonb;
  v_base date;
  v_end date;
  v_requested_start date;
  v_items jsonb;
  v_missing_items jsonb;
  v_foreign_sales jsonb;
  v_foreign_sales_count integer;
  v_allocated numeric;
  v_missing integer;
  v_total numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  v_summary := public.get_live_performance_summary(p_period);
  v_requested_start := (v_summary->>'period_start')::date;
  v_base := (v_summary->>'start_snapshot_date')::date;
  v_end := (v_summary->>'end_snapshot_date')::date;
  -- The broker's overseas realized-P&L endpoint currently returns no per-sale
  -- amount. Record the affected trades as coverage gaps without inventing P&L.
  with foreign_trades as (
    select t.security_id,coalesce(s.symbol,'미확인') as symbol,
           coalesce(s.name,'종목 연결이 없는 해외 매도') as name,count(*)::integer as sale_count,
           max((t.trade_at at time zone 'Asia/Seoul')::date) as last_sell
    from public.transactions t
    join public.accounts a on a.id=t.account_id
    left join public.securities s on s.id=t.security_id
    where a.user_id=v_user and a.mode='live' and a.is_active
      and t.type='sell' and t.currency is distinct from 'KRW'
      and (t.trade_at at time zone 'Asia/Seoul')::date between
        case when v_summary->>'return_ready'='true' and v_base is not null
          then greatest(v_requested_start,v_base+1) else v_requested_start end
        and (v_summary->>'period_end')::date
    group by t.security_id,s.symbol,s.name
  )
  select coalesce(sum(sale_count),0)::integer,
         coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,
           'sale_count',sale_count,'last_sell',last_sell)
           order by last_sell desc,symbol),'[]'::jsonb)
  into v_foreign_sales_count,v_foreign_sales
  from foreign_trades;
  if v_summary->>'return_ready' is distinct from 'true' or v_base is null or v_end is null then
    return jsonb_build_object('ok',true,'ready',false,'period_start',v_requested_start,
      'period_end',v_summary->>'period_end','foreign_sales_without_detail',v_foreign_sales_count,
      'foreign_sale_items',v_foreign_sales,'items','[]'::jsonb);
  end if;
  v_total := (v_summary->>'investment_pnl')::numeric;

  with owned as (
    select a.id from public.accounts a where a.user_id=v_user and a.mode='live' and a.is_active
  ),
  begin_positions as (
    select ds.account_id,ds.security_id,ds.quantity,
      ds.market_value*coalesce(ds.fx_rate_to_base,1) as value_krw
    from public.daily_security_snapshots ds join owned a on a.id=ds.account_id
    where ds.snapshot_date=v_base
  ),
  end_positions as (
    select ds.account_id,ds.security_id,ds.quantity,
      ds.market_value*coalesce(ds.fx_rate_to_base,1) as value_krw
    from public.daily_security_snapshots ds join owned a on a.id=ds.account_id
    where ds.snapshot_date=v_end
  ),
  matching_positions as (
    select b.account_id,b.security_id,e.value_krw-b.value_krw as price_change
    from begin_positions b join end_positions e
      on e.account_id=b.account_id and e.security_id=b.security_id
    where b.quantity=e.quantity and b.quantity<>0
      and b.value_krw is not null and e.value_krw is not null
      and not exists (
        select 1 from public.transactions t where t.account_id=b.account_id
          and t.security_id=b.security_id and t.type in ('buy','sell')
          and (t.trade_at at time zone 'Asia/Seoul')::date>v_base
          and (t.trade_at at time zone 'Asia/Seoul')::date<=v_end
      )
  ),
  marked as (select security_id,sum(price_change) as price_change from matching_positions group by security_id),
  official_realized as (
    select r.security_id,sum(r.realized_pnl) as pnl
    from public.realized_pnl_events r join owned a on a.id=r.account_id
    where r.security_id is not null and r.realized_date>v_base and r.realized_date<=v_end
      and coalesce(r.provider_payload->>'trd_dl_ccd','01')='01'
    group by r.security_id
  ),
  paid_dividends as (
    select d.security_id,sum(d.net_amount*coalesce(d.fx_rate_to_base,1)) as net
    from public.dividends d join owned a on a.id=d.account_id
    where d.security_id is not null
      and (d.paid_at at time zone 'Asia/Seoul')::date>v_base
      and (d.paid_at at time zone 'Asia/Seoul')::date<=v_end
    group by d.security_id
  ),
  manual as (
    select ma.security_id,
      sum(ma.amount) filter(where ma.kind='realized_pnl') as pnl,
      sum(ma.amount) filter(where ma.kind='dividend') as net
    from public.manual_adjustments ma join owned a on a.id=ma.account_id
    where ma.user_id=v_user and ma.active and ma.security_id is not null
      and ma.kind in ('realized_pnl','dividend') and ma.occurred_on>v_base and ma.occurred_on<=v_end
    group by ma.security_id
  ),
  ids as (
    select security_id from marked union select security_id from official_realized
    union select security_id from paid_dividends union select security_id from manual
  ),
  rows as (
    select i.security_id,s.symbol,s.name,
      coalesce(m.price_change,0) as price_change_krw,
      coalesce(r.pnl,0)+coalesce(x.pnl,0) as realized_pnl_krw,
      coalesce(d.net,0)+coalesce(x.net,0) as dividend_net_krw,
      coalesce(m.price_change,0)+coalesce(r.pnl,0)+coalesce(x.pnl,0)+coalesce(d.net,0)+coalesce(x.net,0) as contribution_krw
    from ids i join public.securities s on s.id=i.security_id
    left join marked m on m.security_id=i.security_id
    left join official_realized r on r.security_id=i.security_id
    left join paid_dividends d on d.security_id=i.security_id
    left join manual x on x.security_id=i.security_id
  ),
  missing as (
    select e.security_id,s.symbol,s.name,a.name as account_name,e.quantity as end_quantity,
      case when b.security_id is null then '시작일 종목 잔고 없음'
        when b.quantity<>e.quantity then '기간 중 보유 수량 변경'
        when exists (select 1 from public.transactions t where t.account_id=e.account_id
          and t.security_id=e.security_id and t.type in ('buy','sell')
          and (t.trade_at at time zone 'Asia/Seoul')::date>v_base
          and (t.trade_at at time zone 'Asia/Seoul')::date<=v_end) then '기간 중 매매 기록'
        else '평가액 비교 불가' end as reason
    from end_positions e
    left join matching_positions m on m.account_id=e.account_id and m.security_id=e.security_id
    left join begin_positions b on b.account_id=e.account_id and b.security_id=e.security_id
    join public.accounts a on a.id=e.account_id
    join public.securities s on s.id=e.security_id
    where e.quantity<>0 and m.security_id is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'security_id',security_id,'symbol',symbol,'name',name,
    'price_change_krw',price_change_krw,'realized_pnl_krw',realized_pnl_krw,
    'dividend_net_krw',dividend_net_krw,'contribution_krw',contribution_krw
  ) order by abs(contribution_krw) desc) filter(where security_id is not null),'[]'::jsonb),
  coalesce(sum(contribution_krw),0), (select count(*) from missing),
  (select coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,
    'account_name',account_name,'reason',reason) order by name),'[]'::jsonb) from missing)
  into v_items,v_allocated,v_missing,v_missing_items
  from rows;

  return jsonb_build_object('ok',true,'ready',true,'start_snapshot_date',v_base,
    'end_snapshot_date',v_end,'investment_pnl',v_total,'allocated_krw',v_allocated,
    'unallocated_krw',v_total-v_allocated,'positions_without_comparable_valuation',v_missing,
    'unallocated_positions',v_missing_items,
    'period_start',v_requested_start,'period_end',v_summary->>'period_end',
    'foreign_sales_without_detail',v_foreign_sales_count,'foreign_sale_items',v_foreign_sales,
    'items',v_items);
end;
$$;

revoke all on function public.get_live_period_attribution(text) from public, anon;
grant execute on function public.get_live_period_attribution(text) to authenticated;
