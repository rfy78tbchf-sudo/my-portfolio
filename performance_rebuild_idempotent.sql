CREATE OR REPLACE FUNCTION private.rebuild_account_performance(p_account_id uuid, p_from_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_snapshot record;
  v_previous_date date;
  v_previous_at timestamptz;
  v_previous_assets numeric;
  v_index numeric := 1;
  v_flow numeric;
  v_pnl numeric;
  v_return numeric;
begin
  select s.snapshot_date, s.total_assets, s.snapshot_at into v_previous_date, v_previous_assets, v_previous_at
  from public.daily_account_snapshots s
  where s.account_id = p_account_id and s.snapshot_date < p_from_date
  order by s.snapshot_date desc limit 1;

  select p.twr_index into v_index
  from public.portfolio_performance p
  where p.account_id = p_account_id and p.performance_date < p_from_date
  order by p.performance_date desc limit 1;
  v_index := coalesce(v_index, 1);

  for v_snapshot in
    select s.id, s.snapshot_date, s.snapshot_at, s.total_assets
    from public.daily_account_snapshots s
    where s.account_id = p_account_id and s.snapshot_date >= p_from_date
    order by s.snapshot_date
  loop
    select
      coalesce((select sum(cf.amount * coalesce(cf.fx_rate_to_base, 1))
        from public.cash_flows cf
        where cf.account_id = p_account_id
          and cf.occurred_at > coalesce(v_previous_at, v_snapshot.snapshot_date::timestamp at time zone 'Asia/Seoul')
          and cf.occurred_at <= v_snapshot.snapshot_at), 0)
      + coalesce((select sum(ma.amount)
        from public.manual_adjustments ma
        where ma.account_id = p_account_id and ma.active = true
          and ma.kind = 'external_flow'
          and ma.occurred_on > coalesce(v_previous_date, v_snapshot.snapshot_date - 1)
          and ma.occurred_on <= v_snapshot.snapshot_date), 0)
    into v_flow;

    -- The existing AFTER UPDATE trigger also refreshes this day's performance.
    update public.daily_account_snapshots s set external_flow = v_flow
    where s.id = v_snapshot.id and s.external_flow is distinct from v_flow;

    if v_previous_date is not null then
      v_pnl := coalesce(v_snapshot.total_assets, 0) - coalesce(v_previous_assets, 0) - v_flow;
      v_return := case when coalesce(v_previous_assets, 0) = 0
        then null else v_pnl / v_previous_assets end;
      if v_return is not null then v_index := v_index * (1 + v_return); end if;
      insert into public.portfolio_performance
        (account_id, performance_date, start_value, end_value, external_flow,
         daily_pnl, daily_return, twr_index)
      values
        (p_account_id, v_snapshot.snapshot_date, v_previous_assets,
         v_snapshot.total_assets, v_flow, v_pnl, v_return, v_index)
      on conflict (account_id, performance_date) do update set
        start_value = excluded.start_value,
        end_value = excluded.end_value,
        external_flow = excluded.external_flow,
        daily_pnl = excluded.daily_pnl,
        daily_return = excluded.daily_return,
        twr_index = excluded.twr_index,
        updated_at = now()
      where (public.portfolio_performance.start_value,public.portfolio_performance.end_value,
        public.portfolio_performance.external_flow,public.portfolio_performance.daily_pnl,
        public.portfolio_performance.daily_return,public.portfolio_performance.twr_index)
        is distinct from (excluded.start_value,excluded.end_value,excluded.external_flow,
          excluded.daily_pnl,excluded.daily_return,excluded.twr_index);
    else
      delete from public.portfolio_performance
      where account_id = p_account_id and performance_date = v_snapshot.snapshot_date;
    end if;
    v_previous_date := v_snapshot.snapshot_date;
    v_previous_at := v_snapshot.snapshot_at;
    v_previous_assets := v_snapshot.total_assets;
  end loop;
end;
$function$;
