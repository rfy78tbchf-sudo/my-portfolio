create or replace function public.get_live_sold_holdings(p_period text default 'ALL')
returns jsonb language plpgsql stable set search_path to '' as $function$
declare
  v_user uuid := auth.uid();
  v_account uuid;
  v_today date := timezone('Asia/Seoul',now())::date;
  v_start date;
  v_first date;
  v_items jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select id into v_account from public.accounts
   where user_id=v_user and mode='live' and is_active=true order by created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'items','[]'::jsonb); end if;
  select min((trade_at at time zone 'Asia/Seoul')::date) into v_first
  from public.transactions where account_id=v_account;
  v_start:=case upper(coalesce(p_period,'ALL'))
    when '오늘' then v_today when 'TODAY' then v_today
    when '1W' then v_today-6
    when '1M' then (v_today-interval '1 month')::date
    when '3M' then (v_today-interval '3 months')::date
    when 'YTD' then make_date(extract(year from v_today)::int,1,1)
    when '1Y' then (v_today-interval '1 year')::date
    else coalesce(v_first,v_today) end;
  with sk as (
    select s.id,
      case when s.market='KRX' then regexp_replace(s.symbol,'^A','')
           else coalesce(nullif(r.canonical_symbol,''),s.symbol) end k,
      coalesce(nullif(r.canonical_name,''),s.name) name,
      case when s.market<>'UNKNOWN' then s.market
           else coalesce(nullif((r.exchange_candidates)[1],''),'UNKNOWN') end market
    from public.securities s
    left join private.kb_security_resolution r on r.security_id=s.id and r.resolved=true
  ), held as (
    select distinct sk.k from public.holdings h join sk on sk.id=h.security_id
    where h.account_id=v_account and h.quantity<>0
  ), sells as (
    select sk.k,max(sk.name) name,max(sk.market) market,
           min((t.trade_at at time zone 'Asia/Seoul')::date) first_sell,
           max((t.trade_at at time zone 'Asia/Seoul')::date) last_sell,
           count(*)::int sell_events
    from public.transactions t join sk on sk.id=t.security_id
    where t.account_id=v_account and t.type='sell'
      and (t.trade_at at time zone 'Asia/Seoul')::date between v_start and v_today
    group by sk.k
  ), rp as (
    select sk.k,sum(r.realized_pnl)::numeric official_realized_pnl,
           count(*)::int realized_events, max(r.realized_date) last_realized_date
    from public.realized_pnl_events r join sk on sk.id=r.security_id
    where r.account_id=v_account and r.realized_date between v_start and v_today
      and coalesce(r.provider_payload->>'trd_dl_ccd','01')='01'
    group by sk.k
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'symbol',s.k,'name',s.name,'market',s.market,
    'first_sell',s.first_sell,'last_sell',s.last_sell,'sell_events',s.sell_events,
    'official_realized_pnl',coalesce(rp.official_realized_pnl,0),
    'realized_events',coalesce(rp.realized_events,0),
    'last_realized_date',rp.last_realized_date,
    'realized_status',case when coalesce(rp.realized_events,0)=0 then 'none'
                           when rp.last_realized_date<s.last_sell then 'recent_gap'
                           else 'unverified' end,
    'realized_complete',false
  ) order by s.last_sell desc),'[]'::jsonb)
  into v_items
  from sells s
  left join held h on h.k=s.k
  left join rp on rp.k=s.k
  where h.k is null;
  return jsonb_build_object('ok',true,'period',upper(coalesce(p_period,'ALL')),
    'period_start',v_start,'period_end',v_today,'items',v_items,
    'note','KB 실현손익 기록은 매도 원장의 모든 건과 대조되지 않았으므로 완결된 종목별 손익으로 표시하지 않음');
end;
$function$;
