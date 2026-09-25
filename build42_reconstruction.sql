-- Rebuild a portfolio as of a requested day from immutable broker events.
-- Historic snapshots are used only to confirm cash/valuation, never as trades.
create or replace function public.get_live_reconstructed_portfolio(p_date date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_account uuid;v_last date;v_items jsonb;v_total numeric;v_valued int;
  v_count int;v_unresolved int;v_cash numeric;v_cash_known boolean;v_official numeric;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  select max(snapshot_date) into v_last from public.daily_account_snapshots where account_id=v_account;
  if v_last is null or p_date<'2020-01-01' or p_date>v_last then
    return jsonb_build_object('ok',false,'reason','지원되지 않는 기준일'); end if;
  select cash,total_assets into v_cash,v_official from public.daily_account_snapshots
    where account_id=v_account and snapshot_date=p_date limit 1;
  v_cash_known:=found;
  with identities as materialized (
    select s.id,s.symbol,s.currency,
      coalesce(s.isin,(select nullif(trim(t.provider_payload->>'stnd_is_cd'),'')
        from public.transactions t where t.security_id=s.id
          and trim(t.provider_payload->>'stnd_is_cd')~'^[A-Z]{2}[A-Z0-9]{10}$'
        order by t.trade_at desc limit 1),
        case when s.symbol~'^A[0-9][A-Z0-9]{5}$' and s.currency='KRW'
          then substr(s.symbol,2) else s.symbol end) raw_key
    from public.securities s
  ), canonical as materialized (
    select x.id,x.symbol,x.currency,
      coalesce((select y.raw_key from identities y where y.raw_key~'^[A-Z]{2}[A-Z0-9]{10}$'
        and y.currency=x.currency and (y.symbol=x.symbol or
          (x.symbol~'^A[0-9][A-Z0-9]{5}$' and y.symbol=substr(x.symbol,2)))
        order by y.id limit 1),x.raw_key) asset_key
    from identities x
  ), events as (
    select c.asset_key,t.type,t.quantity,
      case when t.type in ('buy','transfer_in','split_in','corporate_in') then t.quantity
        when t.type in ('sell','transfer_out','split_out','corporate_out') then -t.quantity
        else 0 end change
    from public.transactions t join canonical c on c.id=t.security_id
    where t.account_id=v_account and t.quantity>0
      and (t.trade_at at time zone 'Asia/Seoul')::date<=p_date
      and t.type in ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out')
  ), positions as (
    select asset_key,sum(change) quantity,count(*) events,
      count(*) filter(where type not in ('buy','sell')) non_trade_events
    from events group by asset_key having abs(sum(change))>.000001
  ), valued as (
    select x.asset_key,x.quantity,x.events,x.non_trade_events,
      coalesce((select s.symbol from public.holdings h join canonical c on c.id=h.security_id
        join public.securities s on s.id=h.security_id
        where h.account_id=v_account and c.asset_key=x.asset_key order by h.as_of desc limit 1),
        (select c.symbol from canonical c where c.asset_key=x.asset_key order by length(c.symbol),c.symbol limit 1)) symbol,
      (select c.currency from canonical c where c.asset_key=x.asset_key
         order by case when c.symbol~'^[A-Z]{2}[A-Z0-9]{10}$' then 1 else 0 end limit 1) currency,
      q.close price,q.price_date,q.source price_source,
      case when q.currency='KRW' then 1 else fx.rate end fx_rate,
      case when q.currency='KRW' then 'KRW' else fx.source end fx_source
    from positions x
    left join lateral (select p.price_date,p.close,p.currency,p.source
      from public.daily_security_prices p join canonical c on c.id=p.security_id
      where c.asset_key=x.asset_key and p.price_date<=p_date
        and p.price_date>=p_date-7 and p.close>0
      order by p.price_date desc,case when p.source='kb_openapi' then 0 else 1 end,p.observed_at desc
      limit 1) q on true
    left join lateral (select f.rate,f.source from public.fx_rates f
      where f.base_currency=q.currency and f.quote_currency='KRW'
        and f.rate_date<=coalesce(q.price_date,p_date)
        and f.rate_date>=coalesce(q.price_date,p_date)-7
        and f.rate between 500 and 3000
      order by f.rate_date desc,case when f.source='kb_account_snapshot' then 0 else 1 end
      limit 1) fx on q.currency<>'KRW'
  ) select coalesce(jsonb_agg(jsonb_build_object('asset_key',asset_key,'symbol',symbol,
       'quantity',quantity,'price',price,'price_date',price_date,'price_source',price_source,
       'currency',currency,'fx_rate',fx_rate,'fx_source',fx_source,
       'estimated',fx_source='fed_h10_dexkous_proxy' or price_date<p_date,
       'market_value_krw',case when price is not null and fx_rate is not null
           then quantity*price*fx_rate else null end,
       'event_count',events,'non_trade_events',non_trade_events)
       order by symbol),'[]'::jsonb),
      coalesce(sum(quantity*price*fx_rate),0),
      count(*) filter(where price is not null and fx_rate is not null),
      count(*),count(*) filter(where quantity<-.000001)
    into v_items,v_total,v_valued,v_count,v_unresolved from valued;
  return jsonb_build_object('ok',true,'date',p_date,'security_count',v_count,
    'valued_count',v_valued,'negative_quantity_count',v_unresolved,
    'priced_security_subtotal_krw',v_total,'cash_krw',v_cash,
    'cash_confirmed',v_cash_known,'official_snapshot_assets_krw',v_official,
    'valuation_gap_krw',case when v_cash_known and v_count=v_valued
      then v_official-v_total-v_cash else null end,
    'total_assets_krw',case when v_cash_known and v_count=v_valued and
      v_unresolved=0 and abs(v_official-v_total-v_cash)<=1
      then v_total+v_cash else null end,
    'confidence',case when v_unresolved>0 or v_valued<v_count or
      (v_cash_known and abs(v_official-v_total-v_cash)>1) then '확인 필요'
      when v_cash_known then '일부 추정' else '증권 평가액 일부 추정·현금 미확인' end,
    'items',v_items);
end $$;
revoke all on function public.get_live_reconstructed_portfolio(date) from public,anon;
grant execute on function public.get_live_reconstructed_portfolio(date) to authenticated;

create table if not exists public.kb_backfill_months (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,ledger_rows integer not null default 0,
  settlement_rows integer not null default 0,completed_at timestamptz not null default now(),
  primary key(user_id,month)
);
alter table public.kb_backfill_months enable row level security;
revoke all on public.kb_backfill_months from public,anon;
grant select on public.kb_backfill_months to authenticated;
create policy kb_backfill_owner_read on public.kb_backfill_months for select to authenticated
  using(user_id=(select auth.uid()));

create or replace function public.next_kb_backfill_month_for_service(p_user_id uuid)
returns text language sql security definer set search_path='' as $$
  select to_char(d.month,'YYYY-MM') from
    generate_series('2020-07-01'::date,date_trunc('month',now() at time zone 'Asia/Seoul')::date,'1 month'::interval) d(month)
    where (select auth.role())='service_role'
      and exists(select 1 from public.accounts a where a.user_id=p_user_id and a.provider='kb_securities')
      and not exists(select 1 from public.kb_backfill_months b
        where b.user_id=p_user_id and b.month=d.month::date)
    order by d.month desc limit 1;
$$;
revoke all on function public.next_kb_backfill_month_for_service(uuid) from public,anon,authenticated;
grant execute on function public.next_kb_backfill_month_for_service(uuid) to service_role;

create or replace function public.record_kb_backfill_month_for_service(
 p_user_id uuid,p_month text,p_ledger_rows integer,p_settlement_rows integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select auth.role())<>'service_role' or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    or p_ledger_rows<0 or p_settlement_rows<0 then raise exception 'invalid backfill record'; end if;
  insert into public.kb_backfill_months(user_id,month,ledger_rows,settlement_rows,completed_at)
    values(p_user_id,(p_month||'-01')::date,p_ledger_rows,p_settlement_rows,now())
    on conflict(user_id,month) do update set ledger_rows=excluded.ledger_rows,
      settlement_rows=excluded.settlement_rows,completed_at=excluded.completed_at;
end $$;
revoke all on function public.record_kb_backfill_month_for_service(uuid,text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.record_kb_backfill_month_for_service(uuid,text,integer,integer)
 to service_role;
