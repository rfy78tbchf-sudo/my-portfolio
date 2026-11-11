-- Repeated KB month syncs retain transaction, dividend and realized event IDs.
-- If a provider entry disappears from a later response, keep it for audit until
-- a complete replacement can be independently confirmed.
CREATE OR REPLACE FUNCTION public.apply_kb_history_month_for_service(p_user_id uuid, p_month text, p_transactions jsonb, p_dividends jsonb, p_cash_flows jsonb, p_realized jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account_id uuid;
  v_security_id uuid;
  v_item jsonb;
  v_tx int:=0;
  v_div int:=0;
  v_flow int:=0;
  v_real int:=0;
begin
  select id into v_account_id
  from public.accounts
  where user_id=p_user_id
    and provider='kb_securities'
    and provider_account_ref='openapi-primary'
    and mode='live'
  limit 1;

  if v_account_id is null then
    insert into public.accounts(user_id,provider,provider_account_ref,name,base_currency,mode,is_active)
    values(p_user_id,'kb_securities','openapi-primary','KB증권','KRW','live',true)
    on conflict (user_id,provider,provider_account_ref,mode)
    do update set is_active=true,updated_at=now()
    returning id into v_account_id;
  end if;

  -- An empty/partial API page cannot prove a previously saved entry was removed.

  for v_item in select value from jsonb_array_elements(coalesce(p_transactions,'[]'::jsonb))
  loop
    v_security_id:=null;
    if nullif(v_item->>'symbol','') is not null then
      insert into public.securities(symbol,name,market,asset_type,currency,country)
      values(
        v_item->>'symbol',
        coalesce(nullif(v_item->>'name',''),v_item->>'symbol'),
        coalesce(nullif(v_item->>'market',''),'KRX'),
        'stock',
        coalesce(nullif(v_item->>'currency',''),'KRW'),
        nullif(v_item->>'country','')
      )
      on conflict (symbol,market)
      do update set
        name=excluded.name,
        currency=excluded.currency,
        country=coalesce(excluded.country,public.securities.country),
        updated_at=now()
      returning id into v_security_id;
    end if;

    insert into public.transactions(
      account_id,security_id,external_id,trade_at,settlement_at,type,quantity,price,
      gross_amount,fee,tax,net_amount,currency,fx_rate,realized_pnl,
      official_realized_pnl,source,provider_revision,provider_payload_hash,provider_payload
    )
    values(
      v_account_id,v_security_id,v_item->>'external_id',
      (v_item->>'trade_at')::timestamptz,
      nullif(v_item->>'settlement_at','')::timestamptz,
      v_item->>'type',
      nullif(v_item->>'quantity','')::numeric,
      nullif(v_item->>'price','')::numeric,
      nullif(v_item->>'gross_amount','')::numeric,
      coalesce(nullif(v_item->>'fee','')::numeric,0),
      coalesce(nullif(v_item->>'tax','')::numeric,0),
      nullif(v_item->>'net_amount','')::numeric,
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'fx_rate','')::numeric,
      nullif(v_item->>'realized_pnl','')::numeric,
      nullif(v_item->>'official_realized_pnl','')::numeric,
      'api','SWQA2301',nullif(v_item->>'payload_hash',''),v_item->'provider_payload'
    )
    on conflict (account_id,external_id)
    do update set
      security_id=excluded.security_id,trade_at=excluded.trade_at,settlement_at=excluded.settlement_at,
      type=excluded.type,quantity=excluded.quantity,price=excluded.price,
      gross_amount=excluded.gross_amount,fee=excluded.fee,tax=excluded.tax,
      net_amount=excluded.net_amount,currency=excluded.currency,fx_rate=excluded.fx_rate,
      realized_pnl=coalesce(excluded.realized_pnl,public.transactions.realized_pnl),
      official_realized_pnl=coalesce(excluded.official_realized_pnl,
        public.transactions.official_realized_pnl),
      provider_payload_hash=excluded.provider_payload_hash,provider_payload=excluded.provider_payload,
      updated_at=now()
    where (public.transactions.security_id,public.transactions.trade_at,
      public.transactions.settlement_at,public.transactions.type,
      public.transactions.quantity,public.transactions.price,public.transactions.gross_amount,
      public.transactions.fee,public.transactions.tax,public.transactions.net_amount,
      public.transactions.currency,public.transactions.fx_rate,
      public.transactions.realized_pnl,public.transactions.official_realized_pnl,
      public.transactions.provider_payload_hash,public.transactions.provider_payload)
      is distinct from (excluded.security_id,excluded.trade_at,
      excluded.settlement_at,excluded.type,excluded.quantity,excluded.price,
      excluded.gross_amount,excluded.fee,excluded.tax,excluded.net_amount,
      excluded.currency,excluded.fx_rate,
      coalesce(excluded.realized_pnl,public.transactions.realized_pnl),
      coalesce(excluded.official_realized_pnl,public.transactions.official_realized_pnl),
      excluded.provider_payload_hash,excluded.provider_payload);
    v_tx:=v_tx+1;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_dividends,'[]'::jsonb))
  loop
    v_security_id:=null;
    if nullif(v_item->>'symbol','') is not null then
      select id into v_security_id
      from public.securities
      where symbol=v_item->>'symbol'
      order by case when market='KRX' then 0 else 1 end
      limit 1;
    end if;

    insert into public.dividends(
      account_id,security_id,ex_date,paid_at,gross_amount,tax,net_amount,
      currency,fx_rate_to_base,external_id,source
    )
    values(
      v_account_id,v_security_id,nullif(v_item->>'ex_date','')::date,
      (v_item->>'paid_at')::timestamptz,
      nullif(v_item->>'gross_amount','')::numeric,
      coalesce(nullif(v_item->>'tax','')::numeric,0),
      nullif(v_item->>'net_amount','')::numeric,
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'fx_rate_to_base','')::numeric,
      v_item->>'external_id','api'
    )
    on conflict (account_id,external_id)
    do update set
      security_id=excluded.security_id,ex_date=excluded.ex_date,
      paid_at=excluded.paid_at,gross_amount=excluded.gross_amount,
      tax=excluded.tax,net_amount=excluded.net_amount,currency=excluded.currency,
      fx_rate_to_base=excluded.fx_rate_to_base,updated_at=now()
    where (public.dividends.security_id,public.dividends.ex_date,
      public.dividends.paid_at,public.dividends.gross_amount,public.dividends.tax,
      public.dividends.net_amount,public.dividends.currency,public.dividends.fx_rate_to_base)
      is distinct from (excluded.security_id,excluded.ex_date,excluded.paid_at,
      excluded.gross_amount,excluded.tax,excluded.net_amount,excluded.currency,
      excluded.fx_rate_to_base);
    v_div:=v_div+1;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_cash_flows,'[]'::jsonb))
  loop
    insert into public.cash_flows(
      account_id,occurred_at,type,amount,currency,fx_rate_to_base,external_id,source
    )
    values(
      v_account_id,(v_item->>'occurred_at')::timestamptz,
      v_item->>'type',(v_item->>'amount')::numeric,
      coalesce(nullif(v_item->>'currency',''),'KRW'),
      nullif(v_item->>'fx_rate_to_base','')::numeric,
      v_item->>'external_id','api'
    )
    on conflict (account_id,external_id)
    do update set
      occurred_at=excluded.occurred_at,type=excluded.type,amount=excluded.amount,
      currency=excluded.currency,fx_rate_to_base=excluded.fx_rate_to_base,updated_at=now()
    where (public.cash_flows.occurred_at,public.cash_flows.type,public.cash_flows.amount,
      public.cash_flows.currency,public.cash_flows.fx_rate_to_base)
      is distinct from (excluded.occurred_at,excluded.type,excluded.amount,
        excluded.currency,excluded.fx_rate_to_base);
    v_flow:=v_flow+1;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_realized,'[]'::jsonb))
  loop
    v_security_id:=null;
    if nullif(v_item->>'symbol','') is not null then
      insert into public.securities(symbol,name,market,asset_type,currency,country)
      values(
        v_item->>'symbol',
        coalesce(nullif(v_item->>'name',''),v_item->>'symbol'),
        coalesce(nullif(v_item->>'market',''),'KRX'),
        'stock',
        coalesce(nullif(v_item->>'currency',''),'KRW'),
        nullif(v_item->>'country','')
      )
      on conflict (symbol,market)
      do update set name=excluded.name,updated_at=now()
      returning id into v_security_id;
    end if;

    insert into public.realized_pnl_events(
      account_id,security_id,provider_event_id,realized_date,quantity,sell_price,buy_price,
      sell_amount,buy_amount,fee,tax,realized_pnl,return_rate,currency,source,provider_payload
    )
    values(
      v_account_id,v_security_id,v_item->>'provider_event_id',(v_item->>'realized_date')::date,
      nullif(v_item->>'quantity','')::numeric,nullif(v_item->>'sell_price','')::numeric,
      nullif(v_item->>'buy_price','')::numeric,nullif(v_item->>'sell_amount','')::numeric,
      nullif(v_item->>'buy_amount','')::numeric,coalesce(nullif(v_item->>'fee','')::numeric,0),
      coalesce(nullif(v_item->>'tax','')::numeric,0),coalesce(nullif(v_item->>'realized_pnl','')::numeric,0),
      nullif(v_item->>'return_rate','')::numeric,coalesce(nullif(v_item->>'currency',''),'KRW'),
      'api',v_item->'provider_payload'
    )
    on conflict (account_id,provider_event_id)
    do update set
      security_id=excluded.security_id,realized_date=excluded.realized_date,quantity=excluded.quantity,
      sell_price=excluded.sell_price,buy_price=excluded.buy_price,sell_amount=excluded.sell_amount,
      buy_amount=excluded.buy_amount,fee=excluded.fee,tax=excluded.tax,
      realized_pnl=excluded.realized_pnl,return_rate=excluded.return_rate,
      currency=excluded.currency,provider_payload=excluded.provider_payload,updated_at=now()
    where (public.realized_pnl_events.security_id,public.realized_pnl_events.realized_date,
      public.realized_pnl_events.quantity,public.realized_pnl_events.sell_price,
      public.realized_pnl_events.buy_price,public.realized_pnl_events.sell_amount,
      public.realized_pnl_events.buy_amount,public.realized_pnl_events.fee,
      public.realized_pnl_events.tax,public.realized_pnl_events.realized_pnl,
      public.realized_pnl_events.return_rate,public.realized_pnl_events.currency,
      public.realized_pnl_events.provider_payload)
      is distinct from (excluded.security_id,excluded.realized_date,
      excluded.quantity,excluded.sell_price,excluded.buy_price,
      excluded.sell_amount,excluded.buy_amount,excluded.fee,excluded.tax,
      excluded.realized_pnl,excluded.return_rate,excluded.currency,
      excluded.provider_payload);
    v_real:=v_real+1;
  end loop;

  insert into public.sync_logs(
    account_id,started_at,finished_at,status,scope,rows_read,rows_written,detail
  )
  values(
    v_account_id,now(),now(),'success','kb_history_month',
    jsonb_array_length(coalesce(p_transactions,'[]'::jsonb))
      + jsonb_array_length(coalesce(p_realized,'[]'::jsonb)),
    v_tx+v_div+v_flow+v_real,
    jsonb_build_object('month',p_month,'transactions',v_tx,'dividends',v_div,'cash_flows',v_flow,'realized',v_real,'order_endpoints_enabled',false)
  );

  return jsonb_build_object(
    'ok',true,'month',p_month,'transactions',v_tx,'dividends',v_div,
    'cash_flows',v_flow,'realized',v_real
  );
end;
$function$;

revoke all on function public.apply_kb_history_month_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.apply_kb_history_month_for_service(uuid,text,jsonb,jsonb,jsonb,jsonb)
  to service_role;
