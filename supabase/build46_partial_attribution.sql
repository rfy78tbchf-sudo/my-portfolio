-- Source-backed changes for securities whose quantity stayed fixed. The
-- result is deliberately partial until every cash/position leg reconciles.
create or replace function public.get_live_verified_position_movements(p_period text default '오늘')
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_gate jsonb;v_account uuid;v_start date;v_end date;
  v_start_at timestamptz;v_end_at timestamptz;
  v_rows jsonb;v_total numeric;v_compared int;v_held int;v_omitted int;
begin
  v_gate:=public.get_live_reliable_performance(p_period);
  if coalesce(v_gate->>'state','unavailable')='unavailable' then
    return jsonb_build_object('ok',true,'ready',false,'reason','NAV_WINDOW_UNAVAILABLE'); end if;
  v_start:=(v_gate->>'reliable_start')::date;
  v_end:=(v_gate->>'observed_through')::date;
  select a.id into v_account from public.accounts a where a.user_id=(select auth.uid())
    and a.mode='live' and a.is_active order by a.created_at limit 1;
  select max(o.fetched_at) into v_start_at from public.account_observations o
    where o.account_id=v_account and o.source=v_gate->>'source' and o.balance_date=v_start;
  select max(o.fetched_at) into v_end_at from public.account_observations o
    where o.account_id=v_account and o.source=v_gate->>'source' and o.balance_date=v_end;
  with begin_positions as (
    select s.security_id,s.quantity,s.market_value*coalesce(s.fx_rate_to_base,1) value_krw
    from public.daily_security_snapshots s where s.account_id=v_account and s.snapshot_date=v_start
      and s.quantity>0
  ), end_positions as (
    select s.security_id,s.quantity,s.market_value*coalesce(s.fx_rate_to_base,1) value_krw
    from public.daily_security_snapshots s where s.account_id=v_account and s.snapshot_date=v_end
      and s.quantity>0
  ), compared as (
    select e.security_id,s.symbol,s.name,e.value_krw-b.value_krw change_krw
    from begin_positions b join end_positions e using(security_id)
      join public.securities s on s.id=e.security_id
    where b.quantity=e.quantity and b.value_krw is not null and e.value_krw is not null
      and not exists(select 1 from public.transactions t
        where t.account_id=v_account and t.security_id=e.security_id
          and t.type in ('buy','sell') and (t.trade_at at time zone 'Asia/Seoul')::date>v_start
          and (t.trade_at at time zone 'Asia/Seoul')::date<=v_end)
  )
  select coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,
      'valuation_change_krw',change_krw,'kind','unchanged_quantity_account_valuation')
      order by abs(change_krw) desc),'[]'::jsonb),
      coalesce(sum(change_krw),0),count(*)::int,
      (select count(*)::int from end_positions)
    into v_rows,v_total,v_compared,v_held from compared;
  v_omitted:=greatest(v_held-v_compared,0);
  return jsonb_build_object('ok',true,'ready',true,'start_date',v_start,'end_date',v_end,
    'source',v_gate->>'source','items',v_rows,'compared_positions',v_compared,
    'end_positions',v_held,'omitted_positions',v_omitted,
    'comparable_valuation_change_krw',v_total,
    'attribution_complete',false,'price_contribution_krw',null,
    'fx_contribution_krw',null,'settlement_proceeds_krw',null,
    'position_snapshots_time_aligned',
      exists(select 1 from public.daily_account_snapshots x
        where x.account_id=v_account and x.snapshot_date=v_start and x.snapshot_at=v_start_at)
      and exists(select 1 from public.daily_account_snapshots x
        where x.account_id=v_account and x.snapshot_date=v_end and x.snapshot_at=v_end_at),
    'note','These are position valuation movements for unchanged quantities only. Trade proceeds, FX, tax and other assets are not attributed.');
end $fn$;
revoke all on function public.get_live_verified_position_movements(text) from public,anon;
grant execute on function public.get_live_verified_position_movements(text) to authenticated;
