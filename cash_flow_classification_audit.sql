CREATE OR REPLACE FUNCTION portfolio_internal.reconcile_live_cash_flows_backend()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_account uuid;
  v_first date;
  v_last_at timestamptz;
  v_repaired integer := 0;
  v_overlap integer := 0;
  v_unmatched integer := 0;
  v_after_snapshot integer := 0;
  v_recent_count integer := 0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select a.id into v_account
  from public.accounts a
  where a.user_id = v_user and a.mode = 'live' and a.is_active = true
  order by a.created_at limit 1;
  if v_account is null then
    return jsonb_build_object('ok', false, 'code', 'NO_LIVE_ACCOUNT');
  end if;

  select min(s.snapshot_date), max(s.snapshot_at) into v_first, v_last_at
  from public.daily_account_snapshots s where s.account_id = v_account;

  with ordered as (
    select s.snapshot_date, s.snapshot_at, s.total_assets, s.external_flow,
      lag(s.snapshot_at) over (order by s.snapshot_date) prev_at,
      lag(s.snapshot_date) over (order by s.snapshot_date) prev_date,
      lag(s.total_assets) over (order by s.snapshot_date) prev_assets
    from public.daily_account_snapshots s where s.account_id = v_account
  ), expected as (
    select o.*,
      public.allocated_external_flow(v_account,o.prev_at,o.prev_date,
        o.snapshot_at,o.snapshot_date)
      + coalesce((select sum(m.amount) from public.manual_adjustments m
        where m.account_id=v_account and m.active=true and m.kind='external_flow'
          and m.occurred_on > coalesce(o.prev_date,o.snapshot_date-1)
          and m.occurred_on <= o.snapshot_date),0) as expected_flow
    from ordered o
  )
  select count(*) into v_repaired
  from expected e left join public.portfolio_performance p
    on p.account_id=v_account and p.performance_date=e.snapshot_date
  where e.external_flow is distinct from e.expected_flow
    or (e.prev_date is not null and
      (p.external_flow is distinct from e.expected_flow
       or p.daily_pnl is distinct from
         (coalesce(e.total_assets,0)-coalesce(e.prev_assets,0)-e.expected_flow)));

  if v_first is not null then
    perform private.rebuild_account_performance(v_account,v_first);
  end if;

  select count(*) into v_overlap
  from public.manual_adjustments m
  where m.account_id=v_account and m.kind='external_flow' and m.active=true
    and exists (select 1 from public.cash_flows c
      where c.account_id=v_account
        and (c.occurred_at at time zone 'Asia/Seoul')::date=m.occurred_on
        and c.amount*m.amount>0
        and abs(c.amount*coalesce(c.fx_rate_to_base,1)-m.amount)<1);

  select count(*) into v_unmatched
  from public.cash_flows c
  where c.account_id=v_account and c.source='api'
    and not exists (select 1 from public.transactions t
      where t.account_id=c.account_id and t.external_id=c.external_id
        and t.type=c.type);

  -- A new deposit after the saved balance has not yet entered asset value.
  select count(*) into v_after_snapshot
  from public.cash_flows c
  where c.account_id=v_account and v_last_at is not null
    and c.occurred_at>v_last_at;

  select count(*) into v_recent_count
  from public.cash_flows c
  where c.account_id=v_account
    and (c.occurred_at at time zone 'Asia/Seoul')::date
      >= (now() at time zone 'Asia/Seoul')::date-30;

  return jsonb_build_object(
    'ok',true,'checked_at',now(),'repaired_days',v_repaired,
    'manual_overlap_candidates',v_overlap,'unmatched_provider_flows',v_unmatched,
    'after_snapshot_flows',v_after_snapshot,'recent_provider_flows',v_recent_count,
    'delayed_deposits',coalesce((select jsonb_agg(jsonb_build_object(
      'ledger_date',(c.occurred_at at time zone 'Asia/Seoul')::date,
      'balance_date',public.cash_flow_balance_date(c.id),
      'amount_krw',c.amount*coalesce(c.fx_rate_to_base,1)
    ) order by c.occurred_at desc)
      from public.cash_flows c where c.account_id=v_account and c.type='deposit'
        and public.cash_flow_balance_date(c.id) is not null
        and (c.occurred_at at time zone 'Asia/Seoul')::date >=
          (now() at time zone 'Asia/Seoul')::date-30),'[]'::jsonb),
    'first_snapshot_date',v_first,
    'status',case when v_overlap+v_unmatched+v_after_snapshot>0 then 'review' else 'ok' end
  );
end;
$function$;

-- Only correct conversions whose saved KRW cash leg and USD leg have a
-- credible observed exchange ratio. No provider record or identity changes.
update public.transactions t set
  type='fx',currency='KRW',fx_rate=1,
  net_amount=case when t.provider_payload->>'smry_nm' ~ '출금' then -abs(t.net_amount)
                  when t.provider_payload->>'smry_nm' ~ '입금' then abs(t.net_amount)
                  else t.net_amount end,
  gross_amount=case when t.provider_payload->>'smry_nm' ~ '출금' then -abs(t.net_amount)
                    when t.provider_payload->>'smry_nm' ~ '입금' then abs(t.net_amount)
                    else t.net_amount end,
  updated_at=now()
where t.security_id is null and t.quantity is null
  and t.type in ('fx','buy','sell') and t.currency='USD'
  and t.provider_payload->>'smry_nm' ~ '외화매수|외화매도|환전'
  and t.fx_rate between 500 and 3000 and t.gross_amount<>0
  and abs(t.net_amount/t.gross_amount) between 500 and 3000;
