CREATE OR REPLACE FUNCTION public.apply_kb_current_snapshot_for_service(p_user_id uuid, p_snapshot_date date, p_holdings jsonb, p_summary jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account_id uuid;
  v_security_id uuid;
  v_item jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_written int := 0;
  v_overlay_total_assets numeric := 0;
  v_overlay_cash numeric := 0;
  v_overlay_securities numeric := 0;
  v_overlay_invested numeric := 0;
  v_overlay_unrealized numeric := 0;
  v_overlay_count int := 0;
  v_requested_at timestamptz;
  v_latest_requested_at timestamptz;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if p_snapshot_date is distinct from timezone('Asia/Seoul',now())::date then raise exception 'current snapshot cannot overwrite another day'; end if;
  if jsonb_typeof(p_holdings) is distinct from 'array' or jsonb_typeof(p_summary) is distinct from 'object' then raise exception 'incomplete balance payload'; end if;
  if exists(select 1 from unnest(array['total_assets','cash','securities_value','invested_capital','unrealized_pnl']) k
    where p_summary->>k is null or not(p_summary->>k ~ '^[-+]?[0-9]+([.][0-9]+)?$')) then raise exception 'missing numeric balance summary'; end if;
  if exists(select 1 from jsonb_array_elements(p_holdings) x where nullif(x->>'symbol','') is null or x->>'quantity' is null or not(x->>'quantity' ~ '^[0-9]+([.][0-9]+)?$') or x->>'market_value' is null) then raise exception 'incomplete holding'; end if;
  if exists(select 1 from jsonb_array_elements(p_holdings) x group by x->>'symbol',x->>'market' having count(*)>1) then raise exception 'duplicate holding'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kb-snapshot:'||p_user_id::text,0));
  v_requested_at:=nullif(p_summary->>'source_requested_at','')::timestamptz;
  select max((l.detail->>'source_requested_at')::timestamptz) into v_latest_requested_at from public.sync_logs l
    join public.accounts a on a.id=l.account_id where a.user_id=p_user_id and l.scope='kb_current_snapshot' and l.status='success';
  if v_latest_requested_at is not null and (v_requested_at is null or v_requested_at<=v_latest_requested_at) then
    return jsonb_build_object('ok',true,'skipped',true,'reason','SUPERSEDED_BALANCE_RESPONSE');
  end if;


  insert into public.accounts(user_id,provider,provider_account_ref,name,base_currency,mode,is_active)
  values(p_user_id,'kb_securities','openapi-primary','KB증권','KRW','live',true)
  on conflict (user_id,provider,provider_account_ref,mode)
  do update set name=excluded.name,base_currency=excluded.base_currency,is_active=true,updated_at=now()
  returning id into v_account_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_holdings,'[]'::jsonb))
  loop
    if nullif(v_item->>'symbol','') is null then continue; end if;

    insert into public.securities(symbol,name,market,asset_type,currency,sector,country,isin)
    values(
      v_item->>'symbol',
      coalesce(nullif(v_item->>'name',''),v_item->>'symbol'),
      coalesce(nullif(v_item->>'market',''),'UNKNOWN'),
      coalesce(nullif(v_item->>'asset_type',''),'stock'),
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'sector',''),
      nullif(v_item->>'country',''),
      nullif(v_item->>'isin','')
    )
    on conflict (symbol,market)
    do update set
      name=excluded.name,
      asset_type=excluded.asset_type,
      currency=excluded.currency,
      sector=coalesce(excluded.sector,public.securities.sector),
      country=coalesce(excluded.country,public.securities.country),
      isin=coalesce(excluded.isin,public.securities.isin),
      updated_at=now()
    returning id into v_security_id;

    v_ids := array_append(v_ids,v_security_id);

    insert into public.holdings(
      account_id,security_id,as_of,quantity,avg_cost,market_price,market_value,
      unrealized_pnl,unrealized_pnl_rate,official_unrealized_pnl,currency,
      fx_rate_to_base,source,provider_payload
    )
    values(
      v_account_id,v_security_id,now(),
      coalesce((v_item->>'quantity')::numeric,0),
      nullif(v_item->>'avg_cost','')::numeric,
      nullif(v_item->>'market_price','')::numeric,
      nullif(v_item->>'market_value','')::numeric,
      nullif(v_item->>'unrealized_pnl','')::numeric,
      nullif(v_item->>'unrealized_pnl_rate','')::numeric,
      nullif(v_item->>'official_unrealized_pnl','')::numeric,
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'fx_rate_to_base','')::numeric,
      'api',v_item->'provider_payload'
    )
    on conflict (account_id,security_id)
    do update set
      as_of=excluded.as_of,quantity=excluded.quantity,avg_cost=excluded.avg_cost,
      market_price=excluded.market_price,market_value=excluded.market_value,
      unrealized_pnl=excluded.unrealized_pnl,unrealized_pnl_rate=excluded.unrealized_pnl_rate,
      official_unrealized_pnl=excluded.official_unrealized_pnl,currency=excluded.currency,
      fx_rate_to_base=excluded.fx_rate_to_base,source='api',
      provider_payload=excluded.provider_payload,updated_at=now();

    insert into public.daily_security_snapshots(
      account_id,security_id,snapshot_date,quantity,market_price,market_value,
      avg_cost,unrealized_pnl,currency,fx_rate_to_base
    )
    values(
      v_account_id,v_security_id,p_snapshot_date,
      coalesce((v_item->>'quantity')::numeric,0),
      nullif(v_item->>'market_price','')::numeric,
      nullif(v_item->>'market_value','')::numeric,
      nullif(v_item->>'avg_cost','')::numeric,
      nullif(v_item->>'unrealized_pnl','')::numeric,
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'fx_rate_to_base','')::numeric
    )
    on conflict (account_id,security_id,snapshot_date)
    do update set
      quantity=excluded.quantity,market_price=excluded.market_price,
      market_value=excluded.market_value,avg_cost=excluded.avg_cost,
      unrealized_pnl=excluded.unrealized_pnl,currency=excluded.currency,
      fx_rate_to_base=excluded.fx_rate_to_base,updated_at=now();

    v_written := v_written + 1;
  end loop;

  if cardinality(v_ids) > 0 then
    delete from public.holdings
    where account_id=v_account_id and source='api' and not (security_id=any(v_ids));

    delete from public.daily_security_snapshots
    where account_id=v_account_id
      and snapshot_date=p_snapshot_date
      and not (security_id=any(v_ids));
  else
    delete from public.holdings where account_id=v_account_id and source='api';
    delete from public.daily_security_snapshots
    where account_id=v_account_id and snapshot_date=p_snapshot_date;
  end if;

  with latest as (
    select distinct on (m.provider,m.subaccount_key)
      m.total_assets,m.cash,m.securities_value,m.invested_capital,m.unrealized_pnl
    from public.manual_subaccount_snapshots m
    where m.user_id=p_user_id
      and m.active=true
      and m.snapshot_date<=p_snapshot_date
    order by m.provider,m.subaccount_key,m.snapshot_date desc,m.updated_at desc
  )
  select
    coalesce(sum(total_assets),0),
    coalesce(sum(cash),0),
    coalesce(sum(securities_value),0),
    coalesce(sum(invested_capital),0),
    coalesce(sum(unrealized_pnl),0),
    count(*)::int
  into
    v_overlay_total_assets,v_overlay_cash,v_overlay_securities,
    v_overlay_invested,v_overlay_unrealized,v_overlay_count
  from latest;

  insert into public.daily_account_snapshots(
    account_id,snapshot_date,snapshot_at,total_assets,cash,securities_value,
    invested_capital,unrealized_pnl,realized_pnl,dividends,interest,fees,taxes,total_pnl,external_flow
  )
  values(
    v_account_id,p_snapshot_date,now(),
    coalesce((p_summary->>'total_assets')::numeric,0)+v_overlay_total_assets,
    coalesce((p_summary->>'cash')::numeric,0)+v_overlay_cash,
    coalesce((p_summary->>'securities_value')::numeric,0)+v_overlay_securities,
    coalesce((p_summary->>'invested_capital')::numeric,0)+v_overlay_invested,
    coalesce((p_summary->>'unrealized_pnl')::numeric,0)+v_overlay_unrealized,
    coalesce((p_summary->>'realized_pnl')::numeric,0),
    coalesce((p_summary->>'dividends')::numeric,0),
    coalesce((p_summary->>'interest')::numeric,0),
    coalesce((p_summary->>'fees')::numeric,0),
    coalesce((p_summary->>'taxes')::numeric,0),
    coalesce((p_summary->>'total_pnl')::numeric,0)+v_overlay_unrealized,
    coalesce((p_summary->>'external_flow')::numeric,0)
  )
  on conflict (account_id,snapshot_date)
  do update set
    snapshot_at=excluded.snapshot_at,total_assets=excluded.total_assets,cash=excluded.cash,
    securities_value=excluded.securities_value,invested_capital=excluded.invested_capital,
    unrealized_pnl=excluded.unrealized_pnl,realized_pnl=excluded.realized_pnl,
    dividends=excluded.dividends,interest=excluded.interest,fees=excluded.fees,
    taxes=excluded.taxes,total_pnl=excluded.total_pnl,external_flow=excluded.external_flow,
    updated_at=now();

  insert into public.sync_logs(
    account_id,started_at,finished_at,status,scope,rows_read,rows_written,detail
  )
  values(
    v_account_id,now(),now(),'success','kb_current_snapshot',
    jsonb_array_length(coalesce(p_holdings,'[]'::jsonb)),v_written,
    jsonb_build_object(
      'source_requested_at',v_requested_at,'provider','KB Securities',
      'snapshot_date',p_snapshot_date,
      'order_endpoints_enabled',false,
      'manual_subaccounts_included',v_overlay_count,
      'manual_overlay_assets',v_overlay_total_assets
    )
  );

  return jsonb_build_object(
    'ok',true,'account_id',v_account_id,'holdings_written',v_written,
    'snapshot_date',p_snapshot_date,
    'manual_subaccounts_included',v_overlay_count,
    'manual_overlay_assets',v_overlay_total_assets
  );
end;
$function$;

