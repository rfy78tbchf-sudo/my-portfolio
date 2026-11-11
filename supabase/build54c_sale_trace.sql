-- Drill into the same per-sale engine. These rows explain its input and do not
-- independently recompute or silently reorder the moving-average allocation.
create or replace function public.get_live_realized_sale_trace(
  p_transaction_id uuid,p_period text default '1M',p_account uuid default null)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_report jsonb;
  v_sale jsonb;
  v_account uuid;
  v_security uuid;
  v_sale_date date;
  v_count integer;
  v_entries jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  v_report:=public.get_live_realized_sales(p_period,p_account);
  if not coalesce((v_report->>'ok')::boolean,false) then return v_report; end if;
  v_account:=(v_report->>'account_id')::uuid;
  select x into v_sale from jsonb_array_elements(v_report->'items') x
    where x->>'transaction_id'=p_transaction_id::text limit 1;
  if v_sale is null then return jsonb_build_object('ok',false,'reason','SALE_NOT_IN_SELECTED_PERIOD'); end if;
  select t.security_id into v_security from public.transactions t
    where t.id=p_transaction_id and t.account_id=v_account and t.type='sell';
  if v_security is null then return jsonb_build_object('ok',false,'reason','SALE_NOT_OWNED'); end if;
  v_sale_date:=(v_sale->>'trade_date')::date;
  select count(*) into v_count from public.transactions t
    where t.account_id=v_account and t.security_id=v_security and t.type in ('buy','sell')
      and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<=v_sale_date;
  select coalesce(jsonb_agg(jsonb_build_object(
    'transaction_id',z.id,'event_date',z.event_date,'ledger_date',z.ledger_date,
    'date_basis',z.date_basis,'type',z.type,'quantity',z.quantity,
    'net_amount',z.net_amount,'fee',z.fee,'tax',z.tax,'currency',z.currency,
    'fx_rate',z.rate,'fx_date',z.rate_date,'fx_source',z.rate_source)
    order by z.event_date,z.ledger_date,z.id),'[]'::jsonb) into v_entries
  from (
    select t.id,(coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date event_date,
      (t.trade_at at time zone 'Asia/Seoul')::date ledger_date,
      case when t.order_at is null then 'ledger_date_execution_unverified'
        else 'broker_order_date_no_intraday_time' end date_basis,
      t.type,t.quantity,t.net_amount,t.fee,t.tax,t.currency,
      case when t.currency='KRW' then 1 else f.rate end rate,
      case when t.currency='KRW' then (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date
        else f.rate_date end rate_date,
      case when t.currency='KRW' then 'transaction_currency_krw' else f.source end rate_source
    from public.transactions t
    left join lateral (
      select r.rate,r.rate_date,r.source from public.fx_rates r
      where t.currency='USD' and r.base_currency='USD' and r.quote_currency='KRW'
        and r.rate_date between
          (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date-4 and
          (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date
        and r.rate>0 order by r.rate_date desc,r.observed_at desc limit 1
    ) f on true
    where t.account_id=v_account and t.security_id=v_security and t.type in ('buy','sell')
      and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<=v_sale_date
    order by coalesce(t.order_at,t.trade_at) desc,t.id desc limit 100
  ) z;
  return jsonb_build_object('ok',true,'sale',v_sale,'account_id',v_account,
    'calculation_version',v_report->'calculation_version',
    'source_transaction_count',v_count,'truncated',v_count>100,
    'source_transactions',v_entries,
    'note','Same-day ledger order is not proof of execution order');
end $fn$;
revoke all on function public.get_live_realized_sale_trace(uuid,text,uuid) from public,anon;
grant execute on function public.get_live_realized_sale_trace(uuid,text,uuid) to authenticated;
