-- Integration fixture against the actual trigger/rebuild functions. Always rollback.
begin;
do $$
declare
  v_user uuid;
  v_normal uuid;
  v_delayed uuid;
  v_flow uuid;
  v_before jsonb;
  v_after jsonb;
begin
  select user_id into v_user from public.accounts where mode='live' limit 1;
  if v_user is null then raise exception 'test user not found'; end if;
  insert into public.accounts(user_id,provider,provider_account_ref,name,mode,is_active)
    values(v_user,'fixture','cash-normal-'||gen_random_uuid(),'temporary test','demo',false)
    returning id into v_normal;
  insert into public.accounts(user_id,provider,provider_account_ref,name,mode,is_active)
    values(v_user,'fixture','cash-delayed-'||gen_random_uuid(),'temporary test','demo',false)
    returning id into v_delayed;

  -- Deposit, withdrawal and P&L coexist. Actual gain is 10,000 + 50,000.
  insert into public.cash_flows(account_id,occurred_at,type,amount,currency,external_id)
    values(v_normal,'2026-01-02 04:00+00','deposit',5000000,'KRW','fixture-deposit-'||v_normal),
      (v_normal,'2026-01-03 04:00+00','withdrawal',-2000000,'KRW','fixture-withdraw-'||v_normal);
  insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets,unrealized_pnl)
    values(v_normal,'2026-01-01','2026-01-01 09:00+00',10000000,0),
      (v_normal,'2026-01-02','2026-01-02 09:00+00',15010000,10000),
      (v_normal,'2026-01-03','2026-01-03 09:00+00',13060000,60000);
  perform private.rebuild_account_performance(v_normal,'2026-01-01');
  if exists(select 1 from public.portfolio_performance
      where account_id=v_normal and
      ((performance_date='2026-01-02' and (external_flow<>5000000 or daily_pnl<>10000))
      or (performance_date='2026-01-03' and (external_flow<>-2000000 or daily_pnl<>50000))))
    or (select count(*) from public.portfolio_performance where account_id=v_normal)<>2 then
    raise exception 'deposit/withdrawal was included in P&L';
  end if;
  select jsonb_agg(to_jsonb(p) order by performance_date) into v_before
    from public.portfolio_performance p where account_id=v_normal;
  perform private.rebuild_account_performance(v_normal,'2026-01-01');
  select jsonb_agg(to_jsonb(p) order by performance_date) into v_after
    from public.portfolio_performance p where account_id=v_normal;
  if v_before is distinct from v_after then raise exception 'repeat rebuild changed results'; end if;

  -- Ledger date precedes the balance's recognition by one day.
  insert into public.cash_flows(account_id,occurred_at,type,amount,currency,external_id)
    values(v_delayed,'2026-01-02 04:00+00','deposit',5000000,'KRW','fixture-delay-'||v_delayed)
    returning id into v_flow;
  insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets,unrealized_pnl)
    values(v_delayed,'2026-01-01','2026-01-01 09:00+00',10000000,0),
      (v_delayed,'2026-01-02','2026-01-02 09:00+00',10010000,10000),
      (v_delayed,'2026-01-03','2026-01-03 09:00+00',15060000,60000);
  perform private.rebuild_account_performance(v_delayed,'2026-01-01');
  if public.cash_flow_balance_date(v_flow)<>'2026-01-03'::date then
    raise exception 'delayed recognition date not inferred';
  end if;
  if exists(select 1 from public.portfolio_performance
      where account_id=v_delayed and
      ((performance_date='2026-01-02' and (external_flow<>0 or daily_pnl<>10000))
      or (performance_date='2026-01-03' and (external_flow<>5000000 or daily_pnl<>50000))))
    or (select count(*) from public.portfolio_performance where account_id=v_delayed)<>2 then
    raise exception 'delayed deposit entered performance';
  end if;
end $$;
select 'cash_flow_regression' as test_name,'passed' as result;
rollback;
