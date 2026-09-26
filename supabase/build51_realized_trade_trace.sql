-- A drill-down over the existing moving-average engine. The ledger remains
-- the only cost-allocation path. This function exposes the source transactions
-- used by that engine without recomputing a second P/L figure.
create or replace function public.get_live_realized_trade_evidence(
  p_symbol text, p_period text default '1W')
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_symbol text := upper(trim(coalesce(p_symbol,'')));
  v_account uuid;
  v_report jsonb;
  v_item jsonb;
  v_entries jsonb;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_symbol !~ '^[A-Z0-9.]{1,15}$' or p_period not in
    ('오늘','TODAY','1W','1M','3M','6M','YTD','1Y','ALL') then
    raise exception 'invalid realized evidence request';
  end if;
  select a.id into v_account from public.accounts a
  where a.user_id=(select auth.uid()) and a.provider='kb_securities'
    and a.mode='live' and a.is_active
  order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','ACCOUNT_NOT_FOUND'); end if;
  v_report:=public.get_live_ledger_realized(p_period);
  select x.value into v_item from jsonb_array_elements(v_report->'items') x
    where x.value->>'symbol'=v_symbol limit 1;
  if v_item is null then return jsonb_build_object('ok',false,'reason','NO_SALE_IN_PERIOD'); end if;
  select count(*) into v_count from public.transactions t
    join public.securities s on s.id=t.security_id
    where t.account_id=v_account and s.symbol=v_symbol and t.type in ('buy','sell')
      and t.trade_at < (((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul');
  select coalesce(jsonb_agg(jsonb_build_object(
      'transaction_id',q.id,'trade_at',q.trade_at,'type',q.type,
      'quantity',q.quantity,'gross',q.gross,'fee',q.fee,'tax',q.tax,
      'net_amount',q.net_amount,'currency',q.currency,'source',q.source
    ) order by q.trade_at,q.id),'[]'::jsonb) into v_entries
  from (select t.id,t.trade_at,t.type,t.quantity,t.fee,t.tax,t.net_amount,
      t.currency,t.source,
      case when trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',',''))
             ~ '^[0-9]+(\.[0-9]+)?$'
           then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric
           else null end gross
    from public.transactions t join public.securities s on s.id=t.security_id
    where t.account_id=v_account and s.symbol=v_symbol and t.type in ('buy','sell')
      and t.trade_at < (((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul')
    order by t.trade_at,t.id limit 100) q;
  return jsonb_build_object('ok',true,'account_scope','kb_securities_auto',
    'symbol',v_symbol,'period',p_period,'method',v_item->'method',
    'calculation',v_item,'source_transactions',v_entries,
    'source_transaction_count',v_count,'truncated',v_count>100,
    'note','Original trade currency; this is not official KRW tax P/L');
end $fn$;
revoke all on function public.get_live_realized_trade_evidence(text,text) from public,anon;
grant execute on function public.get_live_realized_trade_evidence(text,text) to authenticated;
