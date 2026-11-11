-- Allocate actual KB deposits to the first saved balance that includes them.
-- A deposit received after today's balance remains pending until a later snapshot.
CREATE OR REPLACE FUNCTION private.set_snapshot_external_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_previous_date date;
  v_previous_at timestamptz;
begin
  select s.snapshot_date, s.snapshot_at into v_previous_date, v_previous_at
  from public.daily_account_snapshots s
  where s.account_id = new.account_id and s.snapshot_date < new.snapshot_date
  order by s.snapshot_date desc limit 1;

  select
    coalesce((select sum(cf.amount * coalesce(cf.fx_rate_to_base, 1))
      from public.cash_flows cf
      where cf.account_id = new.account_id
        and cf.occurred_at > coalesce(v_previous_at, new.snapshot_date::timestamp at time zone 'Asia/Seoul')
        and cf.occurred_at <= new.snapshot_at), 0)
    + coalesce((select sum(ma.amount)
      from public.manual_adjustments ma
      where ma.account_id = new.account_id and ma.active = true
        and ma.kind = 'external_flow'
        and ma.occurred_on > coalesce(v_previous_date, new.snapshot_date - 1)
        and ma.occurred_on <= new.snapshot_date), 0)
  into new.external_flow;
  return new;
end;
$function$;

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
        updated_at = now();
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

CREATE OR REPLACE FUNCTION public.get_live_performance_summary(p_period text DEFAULT '1M'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_user uuid:=(select auth.uid());
  v_account uuid;
  v_today date:=timezone('Asia/Seoul',now())::date;
  v_start date;
  v_first_ledger date;
  v_base public.daily_account_snapshots%rowtype;
  v_end public.daily_account_snapshots%rowtype;
  v_snapshot_days int:=0;
  v_flow numeric:=0;
  v_pnl numeric:=null;
  v_linked numeric:=null;
  v_return_pct numeric:=null;
  v_flow_days int:=0;
  v_realized numeric:=0;
  v_realized_fee numeric:=0;
  v_realized_tax numeric:=0;
  v_div_net numeric:=0;
  v_div_gross numeric:=0;
  v_div_tax numeric:=0;
  v_interest numeric:=0;
  v_misc_fee numeric:=0;
  v_misc_tax numeric:=0;
  m_realized numeric:=0;
  m_dividend numeric:=0;
  m_interest numeric:=0;
  m_fee numeric:=0;
  m_tax numeric:=0;
  v_overseas_sells int:=0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select a.id into v_account
  from public.accounts a
  where a.user_id=v_user and a.mode='live' and a.is_active=true
  order by a.created_at limit 1;
  if v_account is null then
    return jsonb_build_object('ok',false,'code','NO_LIVE_ACCOUNT');
  end if;
  select min((t.trade_at at time zone 'Asia/Seoul')::date)
  into v_first_ledger
  from public.transactions t where t.account_id=v_account;
  v_start:=case upper(coalesce(p_period,'1M'))
    when '오늘' then v_today
    when 'TODAY' then v_today
    when '1W' then v_today-6
    when '1M' then (v_today-interval '1 month')::date
    when '3M' then (v_today-interval '3 months')::date
    when 'YTD' then make_date(extract(year from v_today)::int,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    when 'ALL' then coalesce(v_first_ledger,v_today)
    else (v_today-interval '1 month')::date
  end;
  select s.* into v_end
  from public.daily_account_snapshots s
  where s.account_id=v_account and s.snapshot_date<=v_today
  order by s.snapshot_date desc limit 1;
  if upper(coalesce(p_period,'1M')) in ('오늘','TODAY') then
    select s.* into v_base
    from public.daily_account_snapshots s
    where s.account_id=v_account and s.snapshot_date<v_today
    order by s.snapshot_date desc limit 1;
  else
    select s.* into v_base
    from public.daily_account_snapshots s
    where s.account_id=v_account and s.snapshot_date<=v_start
    order by s.snapshot_date desc limit 1;
  end if;
  if v_base.id is not null and v_end.id is not null and v_end.snapshot_date>v_base.snapshot_date then
    select count(*) into v_snapshot_days
    from public.daily_account_snapshots s
    where s.account_id=v_account
      and s.snapshot_date between v_base.snapshot_date and v_end.snapshot_date;
    select
      coalesce((select sum(cf.amount*coalesce(cf.fx_rate_to_base,1))
        from public.cash_flows cf
        where cf.account_id=v_account
          and cf.occurred_at>v_base.snapshot_at
          and cf.occurred_at<=v_end.snapshot_at),0)
      +
      coalesce((select sum(ma.amount)
        from public.manual_adjustments ma
        where ma.user_id=v_user and ma.account_id=v_account
          and ma.active=true and ma.kind='external_flow'
          and ma.occurred_on>v_base.snapshot_date and ma.occurred_on<=v_end.snapshot_date),0)
    into v_flow;
    v_pnl:=v_end.total_assets-v_base.total_assets-v_flow;
    with ordered as (
      select s.snapshot_date,s.snapshot_at,s.total_assets,
             lag(s.snapshot_at) over(order by s.snapshot_date) prev_at,
             lag(s.snapshot_date) over(order by s.snapshot_date) prev_date,
             lag(s.total_assets) over(order by s.snapshot_date) prev_assets
      from public.daily_account_snapshots s
      where s.account_id=v_account
        and s.snapshot_date between v_base.snapshot_date and v_end.snapshot_date
    ),
    daily as (
      select o.snapshot_date,o.snapshot_at,o.prev_date,o.prev_at,o.prev_assets,o.total_assets,
        coalesce((select sum(cf.amount*coalesce(cf.fx_rate_to_base,1))
          from public.cash_flows cf
          where cf.account_id=v_account
            and cf.occurred_at>o.prev_at
            and cf.occurred_at<=o.snapshot_at),0)
        +
        coalesce((select sum(ma.amount)
          from public.manual_adjustments ma
          where ma.user_id=v_user and ma.account_id=v_account
            and ma.active=true and ma.kind='external_flow'
            and ma.occurred_on>o.prev_date and ma.occurred_on<=o.snapshot_date),0) flow
      from ordered o
      where o.prev_date is not null and o.prev_assets is not null and o.prev_assets<>0
    ),
    returns as (
      select snapshot_date,flow,(total_assets-prev_assets-flow)/prev_assets r
      from daily
    )
    select case when count(*)=0 then null
                when bool_or(r<=-1) then null
                else exp(sum(ln(1+r::double precision)))-1 end,
           count(*) filter(where flow<>0)
    into v_linked,v_flow_days
    from returns;
    if v_linked is not null then v_return_pct:=v_linked*100; end if;
  end if;
  select coalesce(sum(r.realized_pnl),0),coalesce(sum(r.fee),0),coalesce(sum(r.tax),0)
  into v_realized,v_realized_fee,v_realized_tax
  from public.realized_pnl_events r
  where r.account_id=v_account and r.realized_date between v_start and v_today;
  select
    coalesce(sum(coalesce(d.net_amount,0)*coalesce(d.fx_rate_to_base,1)),0),
    coalesce(sum(coalesce(d.gross_amount,0)*coalesce(d.fx_rate_to_base,1)),0),
    coalesce(sum(coalesce(d.tax,0)*coalesce(d.fx_rate_to_base,1)),0)
  into v_div_net,v_div_gross,v_div_tax
  from public.dividends d
  where d.account_id=v_account
    and (d.paid_at at time zone 'Asia/Seoul')::date between v_start and v_today;
  select
    coalesce(sum(case when t.type='interest' then
      coalesce(t.net_amount,0)*case when t.currency='KRW' then 1 else coalesce(t.fx_rate,1) end else 0 end),0),
    coalesce(sum(case when t.type='fee' then
      -coalesce(t.net_amount,0)*case when t.currency='KRW' then 1 else coalesce(t.fx_rate,1) end else 0 end),0),
    coalesce(sum(case when t.type='tax' then
      -coalesce(t.net_amount,0)*case when t.currency='KRW' then 1 else coalesce(t.fx_rate,1) end else 0 end),0),
    count(*) filter(where t.type='sell'
      and coalesce(t.provider_payload->>'stnd_is_cd','')<>''
      and coalesce(t.provider_payload->>'stnd_is_cd','') !~ '^KR')
  into v_interest,v_misc_fee,v_misc_tax,v_overseas_sells
  from public.transactions t
  where t.account_id=v_account
    and (t.trade_at at time zone 'Asia/Seoul')::date between v_start and v_today;
  select
    coalesce(sum(amount) filter(where kind='realized_pnl'),0),
    coalesce(sum(amount) filter(where kind='dividend'),0),
    coalesce(sum(amount) filter(where kind='interest'),0),
    coalesce(sum(amount) filter(where kind='fee'),0),
    coalesce(sum(amount) filter(where kind='tax'),0)
  into m_realized,m_dividend,m_interest,m_fee,m_tax
  from public.manual_adjustments
  where user_id=v_user and account_id=v_account and active=true
    and occurred_on between v_start and v_today;
  v_realized:=v_realized+m_realized;
  v_div_net:=v_div_net+m_dividend;
  v_div_gross:=v_div_gross+m_dividend;
  v_interest:=v_interest+m_interest;
  v_misc_fee:=v_misc_fee+m_fee;
  v_misc_tax:=v_misc_tax+m_tax;
  return jsonb_build_object(
    'ok',true,'period',upper(coalesce(p_period,'1M')),
    'period_start',v_start,'period_end',v_today,'ledger_first_date',v_first_ledger,
    'snapshot_days',v_snapshot_days,'start_snapshot_date',v_base.snapshot_date,
    'end_snapshot_date',v_end.snapshot_date,'start_value',v_base.total_assets,
    'end_value',v_end.total_assets,'external_flow',v_flow,'investment_pnl',v_pnl,
    'return_pct',v_return_pct,'return_ready',v_linked is not null,
    'return_exact',v_linked is not null and v_flow_days=0,'external_flow_days',v_flow_days,
    'return_method',case when v_linked is null then 'insufficient_daily_snapshots'
      when v_flow_days=0 then 'exact_linked_daily_return_no_external_flow'
      else 'daily_flow_adjusted_linked_return' end,
    'realized_pnl',v_realized,'realized_scope','kb_official_plus_manual_adjustments',
    'overseas_sell_events_in_period',v_overseas_sells,'overseas_realized_complete',v_overseas_sells=0,
    'confirmed_breakdown_complete',v_overseas_sells=0,'current_unrealized_pnl',coalesce(v_end.unrealized_pnl,0),
    'dividends_net',v_div_net,'dividends_gross',v_div_gross,'dividend_tax',v_div_tax,
    'trade_fees_included_in_realized',v_realized_fee,'trade_taxes_included_in_realized',v_realized_tax,
    'interest',v_interest,'other_fees',v_misc_fee,'other_taxes',v_misc_tax,
    'manual_adjustments',jsonb_build_object('realized_pnl',m_realized,'dividend',m_dividend,'interest',m_interest,'fee',m_fee,'tax',m_tax),
    'cost_note','KB realized P&L already includes its mapped trade fees and taxes; manual fee/tax adjustments are separate expense corrections'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_live_monthly_performance()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with me as (
  select a.id account_id,a.user_id
  from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active=true
  order by a.created_at limit 1
),
ordered as (
  select s.account_id,s.snapshot_date,s.snapshot_at,s.total_assets,
         lag(s.snapshot_at) over(order by s.snapshot_date) prev_at,
         lag(s.snapshot_date) over(order by s.snapshot_date) prev_date,
         lag(s.total_assets) over(order by s.snapshot_date) prev_assets
  from public.daily_account_snapshots s
  where s.account_id=(select account_id from me)
),
daily as (
  select o.snapshot_date,o.snapshot_at,o.prev_date,o.prev_at,o.prev_assets,o.total_assets,
    coalesce((select sum(cf.amount*coalesce(cf.fx_rate_to_base,1))
      from public.cash_flows cf where cf.account_id=o.account_id
        and cf.occurred_at>o.prev_at
        and cf.occurred_at<=o.snapshot_at),0)
    +
    coalesce((select sum(ma.amount)
      from public.manual_adjustments ma
      where ma.user_id=(select user_id from me) and ma.account_id=o.account_id
        and ma.active=true and ma.kind='external_flow'
        and ma.occurred_on>o.prev_date and ma.occurred_on<=o.snapshot_date),0) flow
  from ordered o
  where o.prev_date is not null and o.prev_assets is not null and o.prev_assets<>0
),
rets as (
  select snapshot_date,flow,total_assets-prev_assets-flow pnl,
         (total_assets-prev_assets-flow)/prev_assets r
  from daily
),
m as (
  select to_char(snapshot_date,'YYYY-MM') as mon,
         min(snapshot_date) first_date,max(snapshot_date) last_date,
         count(*)::int return_days,sum(pnl)::numeric pnl,sum(flow)::numeric external_flow,
         case when bool_or(r<=-1) then null
              else (exp(sum(ln(1+r::double precision)))-1)*100 end linked_return_pct,
         count(*) filter(where flow<>0)::int flow_days
  from rets group by 1
)
select jsonb_build_object(
  'ok',true,
  'items',coalesce(jsonb_agg(jsonb_build_object(
    'month',mon,'first_date',first_date,'last_date',last_date,'return_days',return_days,
    'pnl',pnl,'external_flow',external_flow,'return_pct',linked_return_pct,
    'exact',flow_days=0,'external_flow_days',flow_days,'coverage','partial'
  ) order by mon desc),'[]'::jsonb)
) from m;
$function$;

CREATE OR REPLACE FUNCTION public.get_live_period_attribution(p_period text DEFAULT '1M'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_summary jsonb;
  v_base date;
  v_end date;
  v_base_at timestamptz;
  v_end_at timestamptz;
  v_requested_start date;
  v_items jsonb;
  v_missing_items jsonb;
  v_foreign_sales jsonb;
  v_foreign_sales_count integer;
  v_allocated numeric;
  v_missing integer;
  v_total numeric;
  v_account uuid;
  v_flow numeric;
  v_partial boolean := false;
  v_start_assets numeric;
  v_end_assets numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  v_summary := public.get_live_performance_summary(p_period);
  v_requested_start := (v_summary->>'period_start')::date;
  v_base := (v_summary->>'start_snapshot_date')::date;
  v_end := (v_summary->>'end_snapshot_date')::date;
  -- If the chosen period predates the first saved balance, show only the
  -- recorded subrange, explicitly labelled as partial coverage.
  if v_summary->>'return_ready' is distinct from 'true' and v_end is not null then
    select a.id into v_account from public.accounts a
    where a.user_id=v_user and a.mode='live' and a.is_active
    order by a.created_at limit 1;
    select min(s.snapshot_date) into v_base from public.daily_account_snapshots s
    where s.account_id=v_account and s.snapshot_date>=v_requested_start
      and s.snapshot_date<v_end;
    if v_base is not null then
      v_partial := true;
      select s.total_assets,s.snapshot_at into v_start_assets,v_base_at from public.daily_account_snapshots s
      where s.account_id=v_account and s.snapshot_date=v_base
      order by s.snapshot_at desc limit 1;
      select s.total_assets,s.snapshot_at into v_end_assets,v_end_at from public.daily_account_snapshots s
      where s.account_id=v_account and s.snapshot_date=v_end
      order by s.snapshot_at desc limit 1;
      select coalesce((select sum(c.amount*coalesce(c.fx_rate_to_base,1))
        from public.cash_flows c where c.account_id=v_account
          and c.occurred_at>v_base_at
          and c.occurred_at<=v_end_at),0)
        + coalesce((select sum(m.amount) from public.manual_adjustments m
          where m.user_id=v_user and m.account_id=v_account and m.active
            and m.kind='external_flow' and m.occurred_on>v_base
            and m.occurred_on<=v_end),0) into v_flow;
      v_total := v_end_assets-v_start_assets-v_flow;
    end if;
  end if;
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
        case when v_base is not null
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
  if v_base is null or v_end is null then
    return jsonb_build_object('ok',true,'ready',false,'period_start',v_requested_start,
      'period_end',v_summary->>'period_end','foreign_sales_without_detail',v_foreign_sales_count,
      'foreign_sale_items',v_foreign_sales,'items','[]'::jsonb);
  end if;
  if not v_partial then v_total := (v_summary->>'investment_pnl')::numeric; end if;

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

  return jsonb_build_object('ok',true,'ready',true,'partial',v_partial,'start_snapshot_date',v_base,
    'end_snapshot_date',v_end,'investment_pnl',v_total,'allocated_krw',v_allocated,
    'unallocated_krw',v_total-v_allocated,'positions_without_comparable_valuation',v_missing,
    'unallocated_positions',v_missing_items,
    'period_start',v_requested_start,'period_end',v_summary->>'period_end',
    'foreign_sales_without_detail',v_foreign_sales_count,'foreign_sale_items',v_foreign_sales,
    'items',v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_live_cash_flows()
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
      coalesce((select sum(c.amount * coalesce(c.fx_rate_to_base,1))
        from public.cash_flows c where c.account_id=v_account
          and c.occurred_at > coalesce(o.prev_at,o.snapshot_date::timestamp at time zone 'Asia/Seoul')
          and c.occurred_at <= o.snapshot_at),0)
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
    'first_snapshot_date',v_first,
    'status',case when v_overlap+v_unmatched+v_after_snapshot>0 then 'review' else 'ok' end
  );
end;
$function$;

-- The two snapshot triggers must also run when only the capture time changes.
drop trigger if exists trg_set_snapshot_external_flow on public.daily_account_snapshots;
create trigger trg_set_snapshot_external_flow
before insert or update of snapshot_date,snapshot_at,total_assets
on public.daily_account_snapshots for each row execute function private.set_snapshot_external_flow();
drop trigger if exists trg_upsert_daily_portfolio_performance on public.daily_account_snapshots;
create trigger trg_upsert_daily_portfolio_performance
after insert or update of total_assets,external_flow,snapshot_date,snapshot_at
on public.daily_account_snapshots for each row execute function private.upsert_daily_portfolio_performance();

do $$
declare v_account record;
begin
  for v_account in select account_id,min(snapshot_date) first_date
    from public.daily_account_snapshots group by account_id
  loop
    perform private.rebuild_account_performance(v_account.account_id,v_account.first_date);
  end loop;
end $$;
