-- Keep the existing service-only ownership boundary; never replace known dates.
create or replace function public.link_kb_order_dates_for_service(p_user_id uuid)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_account uuid;v_count integer;v_domestic integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  with candidates as (
    select t.id transaction_id,e.order_date,e.settlement_date,
      count(*) over(partition by t.id) transaction_matches,
      count(*) over(partition by e.id) evidence_matches
    from public.transactions t join public.kb_position_evidence e
      on e.account_id=t.account_id and e.asset_key=trim(t.provider_payload->>'stnd_is_cd')
      and e.active and e.source='SPQM2205' and e.currency='USD'
      and e.settlement_date=(t.trade_at at time zone 'Asia/Seoul')::date
      and e.event_type=t.type and e.quantity=t.quantity and e.price=t.price
    where t.account_id=v_account and t.source='api' and t.provider_revision='SWQA2301'
      and t.currency='USD' and t.type in ('buy','sell') and t.quantity>0 and t.price>0
      and e.asset_key ~ '^US[A-Z0-9]{10}$'
      and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
      and e.evidence->>'source'='SPQM2205' and e.evidence->>'occurrences'='1'
      and e.evidence->>'order_date'=e.order_date::text
      and e.evidence->>'settlement_date'=e.settlement_date::text
      and e.settlement_date between e.order_date and e.order_date+10
      and e.evidence->>'trade_gross' ~ '^[0-9]+([.][0-9]+)?$'
      and case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
        then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end
        =case when e.evidence->>'trade_gross' ~ '^[0-9]+([.][0-9]+)?$'
          then (e.evidence->>'trade_gross')::numeric end
      and abs(case when e.evidence->>'trade_gross' ~ '^[0-9]+([.][0-9]+)?$'
          then (e.evidence->>'trade_gross')::numeric end-e.quantity*e.price)<=0.01
  ), unique_pairs as (
    select * from candidates where transaction_matches=1 and evidence_matches=1
  ) update public.transactions t
    set order_at=p.order_date::timestamp at time zone 'Asia/Seoul',
      settlement_at=p.settlement_date::timestamp at time zone 'Asia/Seoul'
    from unique_pairs p where t.id=p.transaction_id and t.order_at is null
      and (t.settlement_at is null or
        (t.settlement_at at time zone 'Asia/Seoul')::date=p.settlement_date);
  get diagnostics v_count=row_count;
  -- Official domestic trade date, matched independently of disputed cash charges.
  with matches as (
    select t.id,r.realized_date,count(*) over(partition by t.id) nt,
      count(*) over(partition by r.id) nr
    from public.transactions t join public.realized_pnl_events r
      on r.account_id=t.account_id and r.security_id=t.security_id
    where t.account_id=v_account and t.type='sell' and t.currency='KRW' and t.source='api'
      and t.provider_revision='SWQA2301' and t.order_at is null
      and r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
      and r.provider_payload->>'trd_dl_ccd'='01'
      and r.quantity=t.quantity and r.quantity>0 and r.sell_price=t.price
      and r.realized_date between (t.trade_at at time zone 'Asia/Seoul')::date-7
        and (t.trade_at at time zone 'Asia/Seoul')::date
      and to_char(r.realized_date,'YYYYMMDD')=r.provider_payload->>'trd_dt'
      and r.provider_payload->>'stnd_is_cd'=t.provider_payload->>'stnd_is_cd'
      and r.sell_amount>0 and r.buy_amount>0 and r.fee>=0 and r.tax>=0
      and r.sell_amount-r.buy_amount-r.fee-r.tax=r.realized_pnl
      and case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
        then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric=r.sell_amount else false end
  ) update public.transactions t set order_at=m.realized_date::timestamp at time zone 'Asia/Seoul'
    from matches m where t.id=m.id and m.nt=1 and m.nr=1 and t.order_at is null;
  get diagnostics v_domestic=row_count;
  v_count:=v_count+v_domestic;
  return v_count;
end $function$;
revoke all on function public.link_kb_order_dates_for_service(uuid) from public,anon,authenticated;
grant execute on function public.link_kb_order_dates_for_service(uuid) to service_role;
