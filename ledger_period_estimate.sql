-- An evidence-backed per-security estimate for periods without an opening
-- account snapshot. End positions come from KB, opening quantities are
-- reversed from subsequent trades, and FX is the nearest observed KB rate.
-- An unreconciled position or missing start price is excluded, never zeroed.
create or replace function public.get_live_ledger_period_estimate(p_period text default '1M')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_account uuid;
  v_summary jsonb;
  v_start date;
  v_end date;
  v_cutoff timestamptz;
  v_items jsonb;
  v_excluded jsonb;
  v_sum numeric;
  v_included integer;
  v_total integer;
  v_unmapped integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  v_summary := public.get_live_performance_summary(p_period);
  v_start := (v_summary->>'period_start')::date;
  v_end := (v_summary->>'end_snapshot_date')::date;
  select a.id into v_account from public.accounts a
    where a.user_id=v_user and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  if v_account is null or v_start is null or v_end is null then
    return jsonb_build_object('ok',true,'ready',false,'reason','계좌 기준 기록 없음');
  end if;
  if v_start>=v_end then
    return jsonb_build_object('ok',true,'ready',false,'reason','선택한 기간의 마지막 잔고 기록 대기');
  end if;
  select s.snapshot_at into v_cutoff from public.daily_account_snapshots s
    where s.account_id=v_account and s.snapshot_date=v_end
    order by s.snapshot_at desc limit 1;
  if v_cutoff is null then
    return jsonb_build_object('ok',true,'ready',false,'reason','마지막 잔고 시각 없음');
  end if;
  select count(*) into v_unmapped from public.transactions t
    where t.account_id=v_account and t.security_id is null
      and t.type in ('buy','sell') and t.quantity>0 and t.price>0
      and t.trade_at<=v_cutoff
      and ((t.trade_at at time zone 'Asia/Seoul')::date>v_start
        or (p_period='ALL' and (t.trade_at at time zone 'Asia/Seoul')::date=v_start));

  with fx_history as materialized (
    select (t.trade_at at time zone 'Asia/Seoul')::date as d,
           avg(t.fx_rate) as rate, 0 as priority
    from public.transactions t
    where t.account_id=v_account and t.currency='USD'
      and t.fx_rate between 500 and 3000
    group by 1
    union all
    select f.rate_date,f.rate,1 from public.fx_rates f
    where f.base_currency='USD' and f.quote_currency='KRW'
      and f.rate between 500 and 3000
  ),
  security_keys as materialized (
    select s.id,coalesce(
      (select t.provider_payload->>'stnd_is_cd' from public.transactions t
       where t.account_id=v_account and t.security_id=s.id
         and coalesce(t.provider_payload->>'stnd_is_cd','') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
       order by t.trade_at desc limit 1),
      (select t.provider_payload->>'stnd_is_cd' from public.transactions t
       join public.securities other on other.id=t.security_id
       where t.account_id=v_account and other.currency=s.currency
         and other.symbol=case when s.symbol ~ '^A[0-9][A-Z0-9]{5}$'
           then substr(s.symbol,2) else s.symbol end
         and coalesce(t.provider_payload->>'stnd_is_cd','') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
       order by t.trade_at desc limit 1),
      s.isin,
      case when s.symbol ~ '^A[0-9][A-Z0-9]{5}$'
        then substr(s.symbol,2) else s.symbol end
    ) as asset_key
    from public.securities s
  ),
  relevant_trades as (
    select k.asset_key,t.security_id,t.type,t.quantity,t.price,t.net_amount,t.gross_amount,t.fee,
      t.currency,t.fx_rate,(t.trade_at at time zone 'Asia/Seoul')::date as d,
      t.trade_at
    from public.transactions t join security_keys k on k.id=t.security_id
    where t.account_id=v_account and t.security_id is not null
      and t.type in ('buy','sell') and t.trade_at<=v_cutoff
  ),
  traded as (
    select t.asset_key,(array_agg(t.security_id order by t.trade_at desc))[1] as security_id,
      sum(case when t.type='buy' then coalesce(t.quantity,0)
               else -coalesce(t.quantity,0) end) as all_quantity,
      sum(case when t.d>v_start or (p_period='ALL' and t.d=v_start) then
        case when t.type='buy' then coalesce(t.quantity,0)
             else -coalesce(t.quantity,0) end else 0 end) as period_quantity,
      count(*) filter(where t.d>v_start or (p_period='ALL' and t.d=v_start)) as trade_count,
      sum(case when t.d>v_start or (p_period='ALL' and t.d=v_start) then
        (case when t.currency='KRW' and t.gross_amount is not null
            and abs(t.net_amount)>abs(t.gross_amount)*1.2+5000
            then t.gross_amount-coalesce(t.fee,0)
          when t.currency='KRW' then t.net_amount
          when t.currency='USD' and t.fx_rate between 500 and 3000
            and t.gross_amount<>0
            and abs(t.net_amount/t.gross_amount) between 500 and 3000
            then t.gross_amount
          else t.net_amount end)
        * (case when t.currency='KRW' then 1 else f.rate end)
        else 0 end) as trade_cash_krw,
      count(*) filter(where (t.d>v_start or (p_period='ALL' and t.d=v_start)) and
        (t.currency not in ('KRW','USD') or (t.currency='USD' and f.rate is null)
          or t.net_amount is null or t.quantity is null)) as incomplete_trades,
      count(*) filter(where (t.d>v_start or (p_period='ALL' and t.d=v_start)) and t.currency='USD') as fx_estimated_count,
      count(*) filter(where (t.d>v_start or (p_period='ALL' and t.d=v_start))
        and t.currency='KRW' and t.gross_amount is not null
        and abs(t.net_amount)>abs(t.gross_amount)*1.2+5000) as corrected_amount_count
    from relevant_trades t
    left join lateral (
      select x.rate from fx_history x
      where x.d<=t.d and x.d>=t.d-45
      order by x.d desc,x.priority asc limit 1
    ) f on t.currency='USD' and (t.d>v_start or (p_period='ALL' and t.d=v_start))
    group by t.asset_key
  ),
  ending as (
    select k.asset_key,(array_agg(h.security_id order by h.as_of desc))[1] as security_id,
      sum(h.quantity) as quantity,sum(h.market_value*h.fx_rate_to_base) as market_value_krw,
      max(h.currency) as currency,
      bool_or(h.market_value is null or h.fx_rate_to_base is null) as missing_end
    from public.holdings h join security_keys k on k.id=h.security_id
    where h.account_id=v_account group by k.asset_key
  ),
  dividends as (
    select k.asset_key,(array_agg(d.security_id order by d.paid_at desc))[1] as security_id,
      sum(d.net_amount*coalesce(d.fx_rate_to_base,1)) as paid
    from public.dividends d join security_keys k on k.id=d.security_id
    where d.account_id=v_account and d.security_id is not null
      and d.paid_at<=v_cutoff and ((d.paid_at at time zone 'Asia/Seoul')::date>v_start
        or (p_period='ALL' and (d.paid_at at time zone 'Asia/Seoul')::date=v_start))
    group by k.asset_key
  ),
  ids as (
    select asset_key from traded where trade_count>0
    union select asset_key from ending where quantity<>0
    union select asset_key from dividends
  ),
  positioned as (
    select i.asset_key,coalesce(e.security_id,t.security_id,d.security_id) as security_id,
      s.symbol,s.name,
      coalesce(e.currency,s.currency,'KRW') as currency,
      coalesce(e.quantity,0) as end_quantity,
      coalesce(e.quantity,0)-coalesce(t.period_quantity,0) as start_quantity,
      coalesce(t.period_quantity,0) as period_quantity,
      coalesce(t.all_quantity,0) as ledger_end_quantity,
      e.market_value_krw,e.missing_end,
      coalesce(t.trade_count,0) as trade_count,
      coalesce(t.trade_cash_krw,0) as trade_cash_krw,
      coalesce(t.incomplete_trades,0) as incomplete_trades,
      coalesce(t.fx_estimated_count,0) as fx_estimated_count,
      coalesce(t.corrected_amount_count,0) as corrected_amount_count,
      coalesce(d.paid,0) as dividend_krw
    from ids i
    left join traded t on t.asset_key=i.asset_key
    left join ending e on e.asset_key=i.asset_key
    left join dividends d on d.asset_key=i.asset_key
    join public.securities s on s.id=coalesce(e.security_id,t.security_id,d.security_id)
  ),
  evidence as (
    select p.*,
      q.close as start_price,q.price_date as price_date,
      bt.price as trade_reference,bt.d as trade_reference_date,
      f.rate as start_fx
    from positioned p
    left join lateral (
      select x.close,x.price_date from public.daily_security_prices x
      join security_keys k on k.id=x.security_id and k.asset_key=p.asset_key
      where x.price_date<=v_start
        and x.price_date>=v_start-7 and x.close>0
      order by x.price_date desc limit 1
    ) q on p.start_quantity>.000001
    left join lateral (
      select t.price,t.d from relevant_trades t
      where t.asset_key=p.asset_key and t.d<=v_start
        and t.d>=v_start-45 and t.price>0
      order by t.trade_at desc limit 1
    ) bt on p.start_quantity>.000001 and q.close is null
    left join lateral (
      select x.rate from fx_history x where x.d<=v_start and x.d>=v_start-45
      order by x.d desc,x.priority asc limit 1
    ) f on p.currency='USD' and p.start_quantity>.000001
  ),
  classified as (
    select e.*,
      case
        when p_period='ALL' and abs(e.end_quantity-e.ledger_end_quantity)>.0001
          then '최초 거래 이전 보유분 확인 불가'
        when e.start_quantity<-.0001 then '시작 보유수량 재구성 불가'
        when e.incomplete_trades>0 then '거래 금액·환율 근거 부족'
        when e.end_quantity>.000001 and e.missing_end
          then '마지막 평가액 없음'
        when e.start_quantity>.000001 and e.start_price is null and e.trade_reference is null
          then '시작일 가격 근거 없음'
        when e.start_quantity>.000001 and e.currency='USD' and e.start_fx is null
          then '시작일 환율 근거 없음'
        when e.currency not in ('KRW','USD') then '해당 통화 환율 미지원'
        else null end as omission_reason
    from evidence e
  ),
  computed as (
    select c.*,
      case when c.omission_reason is null then
        case when c.end_quantity>.000001 then c.market_value_krw else 0 end
        - case when c.start_quantity>.000001 then
            c.start_quantity*coalesce(c.start_price,c.trade_reference)
              * case when c.currency='KRW' then 1 else c.start_fx end
            else 0 end
        + c.trade_cash_krw+c.dividend_krw
      else null end as contribution_krw
    from classified c
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'security_id',security_id,'symbol',symbol,'name',name,
      'contribution_krw',contribution_krw,'trade_cash_krw',trade_cash_krw,
      'dividend_krw',dividend_krw,'start_quantity',start_quantity,
      'end_quantity',end_quantity,'trade_count',trade_count,
      'quantity_source',case when abs(end_quantity-ledger_end_quantity)>.0001
        then '잔고·기간 매매 역산' else '전체 원장 일치' end,
      'start_price_date',coalesce(price_date,trade_reference_date),
      'price_source',case when start_price is not null then '저장 종가'
        when trade_reference is not null then '인접 거래가격' else '보유 없음' end,
      'fx_estimated_count',fx_estimated_count,'corrected_amount_count',corrected_amount_count
    ) order by abs(contribution_krw) desc) filter(where omission_reason is null),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'security_id',security_id,'symbol',symbol,'name',name,
      'reason',omission_reason,'trade_count',trade_count
    ) order by trade_count desc,symbol) filter(where omission_reason is not null),'[]'::jsonb),
    coalesce(sum(contribution_krw),0),
    count(*) filter(where omission_reason is null),count(*)
  into v_items,v_excluded,v_sum,v_included,v_total
  from computed;
  return jsonb_build_object('ok',true,'ready',true,'method','ledger_mark_to_market_estimate',
    'period_start',v_start,'period_end',v_end,'end_snapshot_at',v_cutoff,
    'estimated_pnl_krw',v_sum,'included_count',v_included,'candidate_count',v_total,
    'unmapped_trade_count',v_unmapped,'items',v_items,'excluded',v_excluded,
    'account_actual_ready',v_summary->>'return_ready'='true',
    'note','종목 손익 추정 합계이며 현금 환차손익, 미연결 거래, 누락 종목은 포함하지 않습니다');
end;
$$;
revoke all on function public.get_live_ledger_period_estimate(text) from public,anon;
grant execute on function public.get_live_ledger_period_estimate(text) to authenticated;
