-- Read-only presentation basis. Raw KB rows and existing ledger amounts remain intact.
-- Each displayed price is derived from the same account, holding, and observation.
create or replace view public.live_holding_display_basis
with (security_invoker=true) as
with original as (
  select h.account_id,h.security_id,h.as_of,h.quantity,h.currency,h.source,
    h.market_value,h.fx_rate_to_base,h.unrealized_pnl,h.market_price,
    h.provider_payload,
    case when h.provider_payload->>'krw_val_amt' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then (h.provider_payload->>'krw_val_amt')::numeric
      when h.provider_payload->>'val_amt' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then (h.provider_payload->>'val_amt')::numeric
      else h.market_value*h.fx_rate_to_base end as valuation_krw,
    case when h.provider_payload->>'krw_exch_byng_amt' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then (h.provider_payload->>'krw_exch_byng_amt')::numeric
      when h.provider_payload->>'byng_amt' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
        and h.currency='KRW' then (h.provider_payload->>'byng_amt')::numeric
      else (h.market_value-h.unrealized_pnl)*h.fx_rate_to_base end as cost_krw,
    case when h.provider_payload->>'krw_exch_val_pl' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then (h.provider_payload->>'krw_exch_val_pl')::numeric
      when h.provider_payload->>'val_pl' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then (h.provider_payload->>'val_pl')::numeric else null end as broker_pnl_krw
  from public.holdings h
)
select account_id,security_id,as_of,quantity,currency,source,
  valuation_krw,cost_krw,valuation_krw-cost_krw as pnl_krw,
  case when cost_krw>0 then (valuation_krw-cost_krw)/cost_krw*100 else null end as rate_pct,
  case when quantity>0 then cost_krw/quantity else null end as average_unit_krw,
  case when quantity>0 then valuation_krw/quantity else null end as valued_unit_krw,
  broker_pnl_krw,
  case when source='api' then 'kb_same_snapshot_value_minus_cost'
    else 'manual_record_value_minus_cost' end as calculation_basis,
  case when broker_pnl_krw is not null and abs(broker_pnl_krw-(valuation_krw-cost_krw))>1
    then true else false end as broker_pnl_differs,
  case when currency<>'KRW' then 'broker_quote_separate_from_valuation' else null end as quote_basis
from original;
revoke all on public.live_holding_display_basis from public,anon;
grant select on public.live_holding_display_basis to authenticated;

-- Source breakdown of the number formerly labelled simply "external flow".
-- ISA opening scope adjustment is not a bank deposit.
create or replace function public.get_live_flow_basis(p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare v_user uuid := (select auth.uid());v_account uuid;v_api numeric;v_scope numeric;v_other numeric;v_api_count int;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select id into v_account from public.accounts where user_id=v_user and provider='kb_securities' and is_active order by created_at limit 1;
  if v_account is null or p_start is null or p_end is null or p_start>p_end then
    return jsonb_build_object('ok',false,'reason','ACCOUNT_OR_PERIOD_UNAVAILABLE');end if;
  select coalesce(sum(c.amount*c.fx_rate_to_base),0),count(*) into v_api,v_api_count
  from public.cash_flows c where c.account_id=v_account and c.type in ('deposit','withdrawal')
    and (c.occurred_at at time zone 'Asia/Seoul')::date between p_start and p_end;
  select coalesce(sum(m.amount) filter(where m.note like 'ISA 최초 추적 편입%'),0),
    coalesce(sum(m.amount) filter(where m.note is null or m.note not like 'ISA 최초 추적 편입%'),0)
    into v_scope,v_other from public.manual_adjustments m
  where m.user_id=v_user and m.account_id=v_account and m.kind='external_flow'
    and m.active and m.occurred_on between p_start and p_end;
  return jsonb_build_object('ok',true,'period_start',p_start,'period_end',p_end,
    'kb_deposit_withdrawal_krw',v_api,'kb_event_count',v_api_count,
    'isa_scope_opening_krw',v_scope,'other_manual_adjustments_krw',v_other,
    'combined_scope_change_krw',v_api+v_scope+v_other,
    'isa_scope_confirmed_in_broker_total',false);
end $fn$;
revoke all on function public.get_live_flow_basis(date,date) from public,anon;
grant execute on function public.get_live_flow_basis(date,date) to authenticated;
