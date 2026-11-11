-- LOCAL ONLY: actual settlement matching with batch-first position input.
-- Completeness is still synthetic; no production rollout until adapter/consumers are integrated.
-- Attribute the NAV component gap to independently dated domestic trades.
-- Read-only: settlement cash is an internal asset/liability, never external flow
-- or additional investment income. Unknown cash and ambiguous matches stay null.
create or replace function public.get_batch_settlement_bridge_273(p_date date)
returns jsonb language sql stable security invoker set search_path='' set jit='off' as $$
with account as materialized (
 select id from public.accounts where user_id=(select auth.uid())
 and mode='live' and is_active and provider='kb_securities' order by created_at limit 1
), snapshot as materialized (
 select s.* from public.daily_account_snapshots s join account a on a.id=s.account_id
 where s.snapshot_date=p_date
), response as materialized (
 select public.read_batch_at_273(a.id::text,s.snapshot_at) b,s.snapshot_at
 from account a join snapshot s on s.account_id=a.id
), valid_response as materialized (
 select b from response where (b->>'complete')::boolean is true
 and (b->>'observed_at')::timestamptz=snapshot_at
), positions as materialized (
 select distinct on (e.symbol) e.symbol,tm.observed_at,e.settled_quantity,
 e.effective_quantity,e.pending_buy_quantity,e.pending_sell_quantity,
 coalesce(s.isin,(select min(trim(t.provider_payload->>'stnd_is_cd'))
 from public.transactions t join public.securities ts on ts.id=t.security_id
 where t.account_id=a.id and ts.currency='KRW' and ts.market=s.market
 and regexp_replace(ts.symbol,'^A([0-9][A-Z0-9]{5})$','\1')=regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1')
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 having count(distinct trim(t.provider_payload->>'stnd_is_cd'))=1)) isin
 from valid_response r cross join account a
 cross join lateral jsonb_to_recordset(r.b->'rows') as e(symbol text,currency text,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
 cross join lateral (select (r.b->>'observed_at')::timestamptz observed_at) tm
 join public.securities s on s.symbol=e.symbol and s.currency='KRW'
 where (tm.observed_at at time zone 'Asia/Seoul')::date=p_date
 and e.currency='KRW'
 order by e.symbol,tm.observed_at desc
), ledger as materialized (
 select t.id,t.security_id,t.type,t.quantity,t.net_amount,t.gross_amount,
 (t.trade_at at time zone 'Asia/Seoul')::date settlement_date,
 trim(t.provider_payload->>'stnd_is_cd') isin
 from public.transactions t join account a on a.id=t.account_id
 where t.source='api' and t.currency='KRW' and t.type in ('buy','sell')
 and (t.trade_at at time zone 'Asia/Seoul')::date>p_date
 and (t.trade_at at time zone 'Asia/Seoul')::date<=p_date+14
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
 and t.quantity>0 and t.net_amount is not null
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 and case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 and replace(trim(t.provider_payload->>'ec_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric=abs(t.gross_amount)
 and replace(trim(t.provider_payload->>'ec_amt'),',','')::numeric=abs(t.net_amount)
 and ((t.type='buy' and t.net_amount<0) or (t.type='sell' and t.net_amount>=0))
 else false end
), batches as materialized (
 select isin,type,settlement_date,sum(quantity) quantity,sum(abs(gross_amount)) gross,
 sum(net_amount) net,array_agg(id order by id) transaction_ids
 from ledger group by isin,type,settlement_date
), candidates as materialized (
 select b.*,r.id official_id,r.realized_date execution_date,
 count(*) over(partition by b.isin,b.type,b.settlement_date) batch_matches,
 count(*) over(partition by r.id) official_matches
 from batches b join public.realized_pnl_events r
 on r.account_id=(select id from account) and r.source='api' and r.currency='KRW'
 and r.provider_event_id like 'KB:SSQM2442:%'
 and trim(r.provider_payload->>'stnd_is_cd')=b.isin
 and trim(r.provider_payload->>'trd_dl_ccd')=case b.type when 'buy' then '02' else '01' end
 and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date<=p_date and r.realized_date>=p_date-14
 and r.realized_date<b.settlement_date and r.quantity=b.quantity
 and case b.type when 'buy' then r.buy_amount else r.sell_amount end=b.gross
), matched as materialized (
 select * from candidates where batch_matches=1 and official_matches=1
), per_security as materialized (
 select isin,sum(quantity) filter(where type='buy') buy_quantity,
 sum(quantity) filter(where type='sell') sell_quantity,sum(net) settlement_net,
 jsonb_agg(jsonb_build_object('execution_date',execution_date,
 'settlement_date',settlement_date,'type',type,'quantity',quantity,
 'net_cash',net,'transaction_ids',transaction_ids,'official_event_id',official_id)
 order by execution_date,settlement_date,type) trades
 from matched group by isin
), checked as materialized (
 select coalesce(p.isin,m.isin) isin,p.symbol,p.observed_at,
 p.pending_buy_quantity,p.pending_sell_quantity,
 coalesce(m.buy_quantity,0) matched_buy_quantity,
 coalesce(m.sell_quantity,0) matched_sell_quantity,m.settlement_net,m.trades,
 coalesce(p.isin is not null and (select count(*) from positions x where x.isin=p.isin)=1
 and p.pending_buy_quantity>=0 and p.pending_sell_quantity>=0
 and p.effective_quantity=p.settled_quantity+p.pending_buy_quantity-p.pending_sell_quantity
 and p.pending_buy_quantity=coalesce(m.buy_quantity,0)
 and p.pending_sell_quantity=coalesce(m.sell_quantity,0),false) quantity_matches
 from positions p full join per_security m on m.isin=p.isin
), aggregate as (
 select count(*) as securities_count,bool_and(quantity_matches) quantities_match,
 coalesce(sum(settlement_net),0) matched_net,
 coalesce(jsonb_agg(to_jsonb(c) order by isin),'[]'::jsonb) items from checked c
)
select jsonb_build_object('ok',exists(select 1 from snapshot),'scope','primary_domestic_unsettled',
 'date',p_date,'snapshot_at',(select snapshot_at from snapshot),
 'position_response_status',case when (select b from response) is null then 'missing'
 when not exists(select 1 from valid_response) then 'incomplete_or_cutoff_mismatch'
 when jsonb_array_length((select b->'rows' from valid_response))=0 then 'complete_empty'
 else 'complete' end,
 'status',case when not exists(select 1 from positions) then 'position_evidence_missing'
 when quantities_match then 'quantity_matched' else 'incomplete_or_ambiguous' end,
 'quantity_matches',coalesce(quantities_match,false) and exists(select 1 from positions),
 'matched_trade_net',case when exists(select 1 from matched) then matched_net
 when quantities_match and securities_count>0 then 0 else null end,
 'pending_settlement_net',case when quantities_match and exists(select 1 from positions) then matched_net else null end,
 'recorded_component_gap',(select total_assets-cash-securities_value from snapshot),
 'remaining_component_gap',case when quantities_match and exists(select 1 from positions)
 then (select total_assets-cash-securities_value from snapshot)-matched_net else null end,
 'valuation_time_verified',exists(select 1 from valid_response),'whole_pnl_verified',false,
 'items',items,'data_version',md5(items::text||coalesce((select b::text from response),'missing')),
 'limitations',jsonb_build_array('DOMESTIC_SETTLEMENT_ONLY','LOCAL_BATCH_INTEGRATION_CANDIDATE',
 'SETTLEMENT_NET_IS_NOT_INVESTMENT_PNL','UNMATCHED_OR_MISSING_TRADES_ARE_NOT_ZERO')) from aggregate;
$$;
revoke all on function public.get_batch_settlement_bridge_273(date) from public,anon;
grant execute on function public.get_batch_settlement_bridge_273(date) to authenticated;
