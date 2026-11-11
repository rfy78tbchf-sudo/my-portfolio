-- Match daily performance to the same external cash flows used by the period summary.
-- Reconcile late-arriving broker deposits and user-entered external-flow corrections.
create or replace function private.set_snapshot_external_flow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_date date;
begin
  select max(s.snapshot_date) into v_previous_date
  from public.daily_account_snapshots s
  where s.account_id = new.account_id and s.snapshot_date < new.snapshot_date;

  select
    coalesce((select sum(cf.amount * coalesce(cf.fx_rate_to_base, 1))
      from public.cash_flows cf
      where cf.account_id = new.account_id
        and (cf.occurred_at at time zone 'Asia/Seoul')::date > coalesce(v_previous_date, new.snapshot_date - 1)
        and (cf.occurred_at at time zone 'Asia/Seoul')::date <= new.snapshot_date), 0)
    + coalesce((select sum(ma.amount)
      from public.manual_adjustments ma
      where ma.account_id = new.account_id and ma.active = true
        and ma.kind = 'external_flow'
        and ma.occurred_on > coalesce(v_previous_date, new.snapshot_date - 1)
        and ma.occurred_on <= new.snapshot_date), 0)
  into new.external_flow;
  return new;
end;
$$;

create or replace function private.rebuild_account_performance(p_account_id uuid, p_from_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot record;
  v_previous_date date;
  v_previous_assets numeric;
  v_index numeric := 1;
  v_flow numeric;
  v_pnl numeric;
  v_return numeric;
begin
  select s.snapshot_date, s.total_assets into v_previous_date, v_previous_assets
  from public.daily_account_snapshots s
  where s.account_id = p_account_id and s.snapshot_date < p_from_date
  order by s.snapshot_date desc limit 1;

  select p.twr_index into v_index
  from public.portfolio_performance p
  where p.account_id = p_account_id and p.performance_date < p_from_date
  order by p.performance_date desc limit 1;
  v_index := coalesce(v_index, 1);

  for v_snapshot in
    select s.id, s.snapshot_date, s.total_assets
    from public.daily_account_snapshots s
    where s.account_id = p_account_id and s.snapshot_date >= p_from_date
    order by s.snapshot_date
  loop
    select
      coalesce((select sum(cf.amount * coalesce(cf.fx_rate_to_base, 1))
        from public.cash_flows cf
        where cf.account_id = p_account_id
          and (cf.occurred_at at time zone 'Asia/Seoul')::date > coalesce(v_previous_date, v_snapshot.snapshot_date - 1)
          and (cf.occurred_at at time zone 'Asia/Seoul')::date <= v_snapshot.snapshot_date), 0)
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
        updated_at = now();
    else
      delete from public.portfolio_performance
      where account_id = p_account_id and performance_date = v_snapshot.snapshot_date;
    end if;
    v_previous_date := v_snapshot.snapshot_date;
    v_previous_assets := v_snapshot.total_assets;
  end loop;
end;
$$;

create or replace function private.reconcile_external_flow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_date date;
  v_new_date date;
  v_old_account uuid;
  v_new_account uuid;
begin
  if tg_table_name = 'cash_flows' then
    if tg_op <> 'INSERT' then
      v_old_account := old.account_id;
      v_old_date := (old.occurred_at at time zone 'Asia/Seoul')::date;
    end if;
    if tg_op <> 'DELETE' then
      v_new_account := new.account_id;
      v_new_date := (new.occurred_at at time zone 'Asia/Seoul')::date;
    end if;
  else
    if tg_op <> 'INSERT' and old.kind = 'external_flow' and old.active then
      v_old_account := old.account_id;
      v_old_date := old.occurred_on;
    end if;
    if tg_op <> 'DELETE' and new.kind = 'external_flow' and new.active then
      v_new_account := new.account_id;
      v_new_date := new.occurred_on;
    end if;
  end if;

  if v_old_account is not null and v_old_date is not null then
    perform private.rebuild_account_performance(v_old_account,
      case when v_old_account = v_new_account then least(v_old_date, v_new_date) else v_old_date end);
  end if;
  if v_new_account is not null and v_new_date is not null
    and (v_old_account is distinct from v_new_account or v_old_date is null) then
    perform private.rebuild_account_performance(v_new_account, v_new_date);
  end if;
  return null;
end;
$$;

create trigger trg_reconcile_cash_flow_performance
after insert or update or delete on public.cash_flows
for each row execute function private.reconcile_external_flow_change();

create trigger trg_reconcile_manual_flow_performance
after insert or update or delete on public.manual_adjustments
for each row execute function private.reconcile_external_flow_change();

revoke all on function private.rebuild_account_performance(uuid, date) from public, anon, authenticated;
revoke all on function private.reconcile_external_flow_change() from public, anon, authenticated;

-- Repair stored daily results that preceded late-arriving deposits and manual corrections.
do $$
declare v_account record;
begin
  for v_account in select account_id, min(snapshot_date) as first_date
    from public.daily_account_snapshots group by account_id
  loop
    perform private.rebuild_account_performance(v_account.account_id, v_account.first_date);
  end loop;
end;
$$;
