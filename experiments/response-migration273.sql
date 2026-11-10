-- CANDIDATE ONLY: requires response-coverage approval and full rollout checks. No backfill.

begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Production-shaped schema candidate; local only until all readers/report producer integrate.
-- No backfill: old normalized evidence never acquires alleged completeness.
create table public.kb_position_response_batches (
 source_observation_id uuid primary key references public.account_observations(id),
 account_id uuid not null references public.accounts(id),
 observed_at timestamptz not null, complete boolean not null,
 rows jsonb not null check(jsonb_typeof(rows)='array'),
 validation jsonb not null check(jsonb_typeof(validation)='object'),
 unique(account_id,observed_at)
);
alter table public.kb_position_response_batches enable row level security;
revoke all on public.kb_position_response_batches from public,anon,authenticated,service_role;
grant select on public.kb_position_response_batches to authenticated;
create policy own_position_response on public.kb_position_response_batches for select to authenticated
 using(exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create function public.save_kb_position_batch_for_response_for_service(p_user_id uuid,p_source_requested_at timestamptz,p_complete boolean,p_rows jsonb,p_validation jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[];a uuid;t timestamptz;r jsonb;k text;
begin
 if p_user_id is null or p_source_requested_at is null or p_complete is null
 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_validation) is distinct from 'object'
 then raise exception 'INVALID_BATCH';end if;
 if jsonb_array_length(p_rows)>1000 or p_validation->>'version' is distinct from 'response-adapter-273'
 or p_validation->>'source' is distinct from 'SSQM2952'
 or p_validation->'complete' is distinct from to_jsonb(p_complete)
 or jsonb_typeof(p_validation->'reasons') is distinct from 'array'
 then raise exception 'BATCH_VALIDATION_INVALID';end if;
 if p_complete and jsonb_array_length(p_validation->'reasons')<>0 then raise exception 'BATCH_VALIDATION_INVALID';end if;
 if (select count(*)<>count(distinct (value->>'symbol',value->>'currency')) from jsonb_array_elements(p_rows)) then raise exception 'DUPLICATE_IDENTITY';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if coalesce(r->>'symbol','') !~ '^[A-Z0-9.]{1,12}$' or coalesce(r->>'currency','') !~ '^[A-Z]{3}$' or r->>'source' is distinct from 'SSQM2952' then raise exception 'INVALID_IDENTITY';end if;
  foreach k in array array['effective_quantity','settled_quantity','pending_buy_quantity','pending_sell_quantity'] loop
   if r ? k and jsonb_typeof(r->k) not in ('number','null') then raise exception 'INVALID_QUANTITY';end if;
   if (r->>k)::numeric<0 or (p_complete and r->>k is null) then raise exception 'INVALID_QUANTITY';end if;
  end loop;
  if p_complete and (r->>'effective_quantity')::numeric is distinct from (r->>'settled_quantity')::numeric+(r->>'pending_buy_quantity')::numeric-(r->>'pending_sell_quantity')::numeric then raise exception 'INCONSISTENT_QUANTITY';end if;
 end loop;
 select array_agg(distinct o.id) into ids from public.account_observations o
 join public.accounts a on a.id=o.account_id join public.sync_logs l on l.account_id=a.id and l.started_at=o.fetched_at
 where a.user_id=p_user_id and a.mode='live' and a.provider='kb_securities'
 and l.scope='kb_current_snapshot' and l.status='success'
 and (l.detail->>'source_requested_at')::timestamptz=p_source_requested_at;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'SOURCE_BINDING_UNAVAILABLE';end if;
 select account_id,fetched_at into a,t from public.account_observations where id=ids[1];
 insert into public.kb_position_response_batches values(ids[1],a,t,p_complete,p_rows,p_validation) on conflict(source_observation_id) do nothing;
 if not exists(select 1 from public.kb_position_response_batches b where b.source_observation_id=ids[1] and b.account_id=a and b.observed_at=t and b.complete=p_complete and b.rows=p_rows and b.validation=p_validation) then raise exception 'CONFLICTING_RETRY';end if;
end $$;
revoke all on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) to service_role;
-- Transitional name keeps the tested consumers on the same read contract.
create function public.read_batch_at_273(a text,t timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('response_id',source_observation_id,'observed_at',observed_at,'complete',complete,'rows',rows)
 from public.kb_position_response_batches where account_id=a::uuid and observed_at<=t order by observed_at desc limit 1
$$;
revoke all on function public.read_batch_at_273(text,timestamptz) from public,anon;
grant execute on function public.read_batch_at_273(text,timestamptz) to authenticated;


-- Local-only. Invoker access uses the existing prototype owner RLS.
create function public.batch_balance_273(a text,s text,c text,t timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
with batch as(select public.read_batch_at_273(a,t) j), picked as (
 select j,r from batch left join lateral (
 select value r from jsonb_array_elements(coalesce(j->'rows','[]'::jsonb)) where value->>'symbol'=s and value->>'currency'=c
 ) x on true
), classified as (
 select j,r,case when j is null then 'missing'
 when (j->>'observed_at')::timestamptz is distinct from t then 'cutoff_mismatch'
 when (j->>'complete')::boolean is not true then 'incomplete'
 when r is null then 'complete_absent'
 when r->>'source' is distinct from 'SSQM2952' or
 (r->>'effective_quantity')::numeric is null or (r->>'settled_quantity')::numeric is null or
 (r->>'pending_buy_quantity')::numeric is null or (r->>'pending_sell_quantity')::numeric is null or
 (r->>'effective_quantity')::numeric is distinct from (r->>'settled_quantity')::numeric+(r->>'pending_buy_quantity')::numeric-(r->>'pending_sell_quantity')::numeric
 then 'quantity_unknown' else 'complete_row' end status from picked
)
select jsonb_build_object('status',status,'response_id',j->'response_id','observed_at',j->'observed_at',
 'symbol',case when status='complete_row' then s end,
 'settled',case when status='complete_row' then r->'settled_quantity' end,
 'effective',case when status='complete_row' then r->'effective_quantity' end,
 'pending_buy',case when status='complete_row' then r->'pending_buy_quantity' end,
 'pending_sell',case when status='complete_row' then r->'pending_sell_quantity' end)
 from classified
$$;
revoke all on function public.batch_balance_273(text,text,text,timestamptz) from public,anon;
grant execute on function public.batch_balance_273(text,text,text,timestamptz) to authenticated,service_role;


-- Holdings quantity only: complete account absence can establish zero, NOT pending cash.
create function public.batch_effective_273(a text,s text,c text,t timestamptz) returns numeric
language sql stable security invoker set search_path='' as $$
with b as(select public.batch_balance_273(a,s,c,t) j,public.read_batch_at_273(a,t) envelope)
select case when j->>'status'='complete_row' then (j->>'effective')::numeric
 when j->>'status'='complete_absent' and not exists(
 select 1 from jsonb_array_elements(envelope->'rows') r where r->>'symbol'=s)
 then 0 else null end from b
$$;
revoke all on function public.batch_effective_273(text,text,text,timestamptz) from public,anon;
grant execute on function public.batch_effective_273(text,text,text,timestamptz) to authenticated,service_role;


-- LOCAL ONLY: actual settlement matching with batch-first position input.
-- Completeness is still synthetic; no production rollout until adapter/consumers are integrated.
-- Attribute the NAV component gap to independently dated domestic trades.
-- Read-only: settlement cash is an internal asset/liability, never external flow
-- or additional investment income. Unknown cash and ambiguous matches stay null.
create or replace function public.get_live_settlement_bridge(p_date date)
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
revoke all on function public.get_live_settlement_bridge(date) from public,anon;
grant execute on function public.get_live_settlement_bridge(date) to authenticated;


-- Build260: aggregate pre-period closed-cycle quantities once; preserve all evidence and financial output.
CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl(p_period text DEFAULT 'THIS_MONTH'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET jit TO 'off'
 SET work_mem TO '16MB'
 SET statement_timeout TO '20s'
AS $function$
select result || jsonb_build_object('reconciliation',public.get_live_nav_reconciliation(p_period)) from (
with account as materialized (
 select id from public.accounts where user_id=(select auth.uid()) and mode='live'
 and is_active and provider='kb_securities' order by created_at limit 1
), owned_transactions as materialized (
 select t.* from public.transactions t join account a on a.id=t.account_id
), owned_date_evidence as materialized (
 select r.*,trim(r.provider_payload->>'stnd_is_cd') evidence_isin,
 trim(r.provider_payload->>'trd_dl_ccd') evidence_side,
 to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt') evidence_date_valid
 from public.realized_pnl_events r join account a on a.id=r.account_id
 where r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
), domestic_date_candidates as materialized (
 -- Independent execution-day evidence. Both sides must have exactly one match.
 select t.id transaction_id,r.id evidence_id,r.realized_date,
 count(*) over(partition by t.id) transaction_matches,
 count(*) over(partition by r.id) evidence_matches
 from owned_transactions t
 join owned_date_evidence r on r.account_id=t.account_id
 and r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
 and r.evidence_isin=trim(t.provider_payload->>'stnd_is_cd')
 and r.evidence_side=case t.type when 'buy' then '02' when 'sell' then '01' end
 and r.quantity=t.quantity and r.sell_price=t.price
 and case when t.type='buy' then r.buy_amount else r.sell_amount end=
 case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end
 and r.evidence_date_valid
 and r.realized_date between (t.trade_at at time zone 'Asia/Seoul')::date-14 and (t.trade_at at time zone 'Asia/Seoul')::date
 where t.source='api' and t.currency='KRW' and t.type in ('buy','sell')
 and t.quantity>0 and t.price>0
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
), individual_dated_transactions as materialized (
 select t.*,coalesce(t.order_at,c.realized_date::timestamp at time zone 'Asia/Seoul') effective_at,
 case when t.order_at is null then c.realized_date end recovered_date
 from owned_transactions t left join domestic_date_candidates c on c.transaction_id=t.id
 and c.transaction_matches=1 and c.evidence_matches=1
), domestic_ledger_groups as materialized (
 select t.account_id,trim(t.provider_payload->>'stnd_is_cd') isin,t.type,
 (t.trade_at at time zone 'Asia/Seoul')::date ledger_date,
 array_agg(t.id) transaction_ids,sum(t.quantity) quantity,
 sum(case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end) gross,
 min((t.effective_at at time zone 'Asia/Seoul')::date) known_min,
 max((t.effective_at at time zone 'Asia/Seoul')::date) known_max
 from individual_dated_transactions t where t.currency='KRW' and t.type in ('buy','sell')
 group by t.account_id,trim(t.provider_payload->>'stnd_is_cd'),t.type,(t.trade_at at time zone 'Asia/Seoul')::date
 having count(*)>1 and bool_and(coalesce(t.source='api' and t.quantity>0 and t.price>0
 and trim(t.provider_payload->>'stnd_is_cd') ~ '^KR[A-Z0-9]{10}$'
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
 and case when replace(trim(t.provider_payload->>'dl_amt'),',','') ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric=t.quantity*t.price else false end,false))
), domestic_group_candidates as materialized (
 select g.*,r.id evidence_id,r.realized_date,
 count(*) over(partition by g.account_id,g.isin,g.type,g.ledger_date) group_matches,
 count(*) over(partition by r.id) evidence_matches
 from domestic_ledger_groups g join owned_date_evidence r on r.account_id=g.account_id
 and r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
 and r.evidence_isin=g.isin
 and r.evidence_side=case g.type when 'buy' then '02' when 'sell' then '01' end
 and r.quantity=g.quantity
 and case when g.type='buy' then r.buy_amount else r.sell_amount end=g.gross
 -- Broker aggregate unit prices can be rounded to the nearest won.
 and r.sell_price>0 and abs(r.sell_price*g.quantity-g.gross)<=g.quantity/2
 and r.evidence_date_valid
 and r.realized_date between g.ledger_date-14 and g.ledger_date
), safe_individual_dates as (
 select c.* from domestic_date_candidates c
 where c.transaction_matches=1 and c.evidence_matches=1
 and not exists(select 1 from domestic_group_candidates g
 where g.evidence_id=c.evidence_id and not(c.transaction_id=any(g.transaction_ids)))
), group_dates as (
 select unnest(g.transaction_ids) transaction_id,g.realized_date
 from domestic_group_candidates g where group_matches=1 and evidence_matches=1
 and (g.known_min is null or g.known_min=g.realized_date)
 and (g.known_max is null or g.known_max=g.realized_date)
 and not exists(select 1 from domestic_date_candidates c
 where c.evidence_id=g.evidence_id and not(c.transaction_id=any(g.transaction_ids)))
), dated_transactions as materialized (
 select t.*,coalesce(t.order_at,i.realized_date::timestamp at time zone 'Asia/Seoul',
 g.realized_date::timestamp at time zone 'Asia/Seoul') effective_at,
 case when t.order_at is null then coalesce(i.realized_date,g.realized_date) end recovered_date,
 (t.order_at is null and i.realized_date is null and g.realized_date is not null) group_date_recovered
 from owned_transactions t left join safe_individual_dates i on i.transaction_id=t.id
 left join group_dates g on g.transaction_id=t.id
), bounds as (
 select public.portfolio_period_start(p_period,(now() at time zone 'Asia/Seoul')::date,(select min(coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date from dated_transactions t join account a on a.id=t.account_id)) as start_date,(select max(h.as_of) from public.holdings h join account a on a.id=h.account_id) as cutoff
) , domestic_period_membership as materialized (
 -- All possible exact matches must be wholly inside this KRW period.
 -- This establishes period membership without inventing an execution date.
 select unnest(array_agg(distinct c.transaction_id)) transaction_id
 from domestic_date_candidates c join owned_transactions t on t.id=c.transaction_id cross join bounds b
 where p_period<>'ALL' and t.currency='KRW' and t.source='api' and t.type in ('buy','sell')
 group by trim(t.provider_payload->>'stnd_is_cd'),t.type,t.quantity,t.price,trim(t.provider_payload->>'dl_amt')
 having count(distinct c.transaction_id)=count(distinct c.evidence_id)
 and bool_and(c.realized_date>=b.start_date and c.realized_date<=(b.cutoff at time zone 'Asia/Seoul')::date
 and (t.trade_at at time zone 'Asia/Seoul')::date<=(b.cutoff at time zone 'Asia/Seoul')::date
 and (t.order_at is null or (t.order_at at time zone 'Asia/Seoul')::date between b.start_date and (b.cutoff at time zone 'Asia/Seoul')::date))
), keys as materialized (
 select s.id,s.symbol,s.name,s.currency,case when s.currency='KRW' then regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1') else coalesce(s.isin,
 (select t.provider_payload->>'stnd_is_cd' from dated_transactions t join account a on a.id=t.account_id
 where t.security_id=s.id and t.provider_payload->>'stnd_is_cd' ~ '^[A-Z]{2}[A-Z0-9]{10}$' order by t.trade_at desc limit 1),
 regexp_replace(s.symbol,'^A([0-9][A-Z0-9]{5})$','\1')) end as asset_key from public.securities s
), verified_domestic_cash as materialized (
 -- A large deduction is not itself an error. Require exact broker cash reconciliation.
 select t.id from dated_transactions t
 where t.source='api' and t.currency='KRW' and t.type='sell'
 and t.quantity>0 and t.price>0 and t.fee>=0 and t.tax>=0 and t.net_amount>=0
 and case when trim(replace(t.provider_payload->>'dl_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(replace(t.provider_payload->>'ec_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(replace(t.provider_payload->>'fee',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'ec_amt'),',','')::numeric=t.net_amount
 and replace(trim(t.provider_payload->>'fee'),',','')::numeric=t.fee
 and replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric-t.fee-t.tax=t.net_amount
 and abs(replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric-t.quantity*t.price)<=t.quantity/2
 else false end
), ipo_records as materialized (
 select t.*,k.asset_key,trim(t.provider_payload->>'smry_nm') ipo_kind,
 case when trim(replace(t.provider_payload->>'dl_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric end raw_gross,
 case when trim(replace(t.provider_payload->>'ec_amt',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(t.provider_payload->>'ec_amt'),',','')::numeric end raw_cash
 from dated_transactions t join keys k on k.id=t.security_id
 where p_period='ALL' and t.currency='KRW'
 and trim(t.provider_payload->>'smry_nm') in ('공모불입 출금','공모추가납입 출금','공모주환불금 입금','공모주 입고')
), verified_ipo as materialized (
 select asset_key,(array_agg(security_id order by trade_at desc))[1] security_id,
 sum(quantity) filter(where ipo_kind='공모주 입고') quantity,
 max(price) filter(where ipo_kind='공모주 입고') price,
 max(trade_at) filter(where ipo_kind='공모주 입고') acquired_at,
 sum(net_amount) cash,array_agg(id) evidence_ids
 from ipo_records t cross join bounds b
 group by asset_key
 having count(*) filter(where ipo_kind='공모주 입고')=1
 and count(*) filter(where ipo_kind='공모불입 출금')=1
 and count(*) filter(where ipo_kind='공모추가납입 출금')<=1
 and count(*) filter(where ipo_kind='공모주환불금 입금')<=1
 and bool_and(coalesce(source='api' and fee>=0 and tax=0 and price>0 and trade_at<=b.cutoff
 and case when ipo_kind='공모주 입고' then type='transfer_in' and quantity>0 and net_amount=0 and raw_cash=0
 when ipo_kind='공모주환불금 입금' then type='other' and net_amount>=0 and raw_cash=net_amount and raw_gross-fee=net_amount
 else type='other' and net_amount<0 and raw_cash=-net_amount and raw_gross+fee=-net_amount end,false))
 and min(price)=max(price)
 and max(trade_at) filter(where ipo_kind<>'공모주 입고')<=max(trade_at) filter(where ipo_kind='공모주 입고')
 and -sum(case when ipo_kind='공모주환불금 입금' then raw_gross when ipo_kind='공모주 입고' then 0 else -raw_gross end)
 =sum(quantity) filter(where ipo_kind='공모주 입고')*max(price) filter(where ipo_kind='공모주 입고')
 and sum(net_amount)<0
 and not exists(select 1 from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='buy')
 and not exists(select 1 from public.holdings h join account a on a.id=h.account_id join keys k on k.id=h.security_id where k.asset_key=t.asset_key and h.quantity<>0)
 and (select sum(x.quantity) from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='sell')=sum(quantity) filter(where ipo_kind='공모주 입고')
 and not exists(select 1 from dated_transactions x join keys k on k.id=x.security_id where k.asset_key=t.asset_key and x.type='sell' and ((coalesce(x.effective_at,x.trade_at) at time zone 'Asia/Seoul')::date<(max(t.trade_at) filter(where t.ipo_kind='공모주 입고') at time zone 'Asia/Seoul')::date or coalesce(x.effective_at,x.trade_at)>max(b.cutoff) or not exists(select 1 from verified_domestic_cash v where v.id=x.id)))
), domestic_raw as materialized (
 select t.*,k.asset_key,n.v raw,n.valid raw_valid
 from dated_transactions t join keys k on k.id=t.security_id
 cross join lateral (
  select jsonb_object_agg(key,case when trim(replace(coalesce(value,''),',','')) ~ '^-?[0-9]+([.][0-9]+)?$' then to_jsonb(replace(trim(value),',','')::numeric) else '0'::jsonb end) v,
  bool_and(trim(replace(coalesce(value,''),',','')) ~ '^-?[0-9]+([.][0-9]+)?$' or trim(coalesce(value,''))='') valid
  from jsonb_each_text(t.provider_payload) where key in ('dl_amt','ec_amt','fee','tx','arrs_fee','etc_lndng_amt_rpay_amt','incm_tx','dl_tx','rsdnt_tx','ffs_tx','trsf_tx')
 ) n where t.currency='KRW' and t.type in ('buy','sell')
), domestic_checked as materialized (
 select t.*,case when t.type='buy' then -abs(t.net_amount)
 when a.exact_components then a.raw_cash+a.loan else t.net_amount end corrected_cash,
 coalesce(t.source='api' and t.quantity>0 and t.price>0 and t.fee>=0 and t.tax>=0
 and (t.type='sell' or t.net_amount<0)
 and t.raw_valid and t.raw ?& array['dl_amt','ec_amt','fee']
 and abs((t.raw->>'dl_amt')::numeric-t.quantity*t.price)<=t.quantity/2
 and (t.raw->>'fee')::numeric=t.fee
 and abs(t.net_amount)=abs((t.raw->>'ec_amt')::numeric)
 and (a.exact_components or (t.net_amount=case when t.type='buy' then -(t.raw->>'ec_amt')::numeric else (t.raw->>'ec_amt')::numeric end
 and abs(abs(t.net_amount)-((t.raw->>'dl_amt')::numeric+case when t.type='buy' then t.fee+t.tax else -t.fee-t.tax end))<=.02)),false) valid
 from domestic_raw t cross join lateral (
 select (t.raw->>'ec_amt')::numeric raw_cash,coalesce((t.raw->>'etc_lndng_amt_rpay_amt')::numeric,0) loan,
 t.type='sell' and t.raw ?& array['tx','arrs_fee','etc_lndng_amt_rpay_amt','incm_tx','dl_tx','rsdnt_tx','ffs_tx','trsf_tx']
 and not exists(select 1 from jsonb_each_text(t.raw) f where f.key<>'ec_amt' and f.value::numeric<0)
 and (t.raw->>'arrs_fee')::numeric>=0 and (t.raw->>'etc_lndng_amt_rpay_amt')::numeric>=0
 and (t.raw->>'tx')::numeric=(t.raw->>'fee')::numeric+(t.raw->>'incm_tx')::numeric+(t.raw->>'dl_tx')::numeric+(t.raw->>'rsdnt_tx')::numeric+(t.raw->>'ffs_tx')::numeric+(t.raw->>'trsf_tx')::numeric
 and (t.raw->>'dl_amt')::numeric-(t.raw->>'tx')::numeric-(t.raw->>'arrs_fee')::numeric-(t.raw->>'etc_lndng_amt_rpay_amt')::numeric=(t.raw->>'ec_amt')::numeric exact_components
 ) a
), ledger as materialized (
 select k.asset_key,t.security_id,t.type,t.quantity,t.currency,
 (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date as day,
 (t.trade_at at time zone 'Asia/Seoul')::date as ledger_day,
 t.effective_at is null and not exists(select 1 from domestic_period_membership pm where pm.transaction_id=t.id) as provisional_date,t.recovered_date,t.group_date_recovered,
 case when p_period<>'ALL' and dc.valid then dc.corrected_cash
 else case when t.type='buy' then -abs(t.net_amount) when t.type='sell' then abs(t.net_amount) end end as cash,
 t.price,t.fee,t.tax,(exists(select 1 from verified_domestic_cash v where v.id=t.id) or (p_period<>'ALL' and coalesce(dc.valid,false))) cash_verified
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 left join domestic_checked dc on dc.id=t.id
 cross join bounds b where t.type in ('buy','sell') and coalesce(t.effective_at,t.trade_at)<=b.cutoff
) , domestic_pending as materialized (
 select k.asset_key,k.id security_id,'sell'::text type,r.quantity,'KRW'::text currency,r.realized_date as day,
 false provisional_date,r.sell_amount-r.fee-r.tax cash,r.sell_price price
 from public.realized_pnl_events r join account a on a.id=r.account_id
 join keys k on k.id=r.security_id cross join bounds b
 where r.source='api' and r.currency='KRW' and k.currency='KRW'
 and r.provider_event_id like 'KB:SSQM2442:%' and trim(r.provider_payload->>'trd_dl_ccd')='01'
 and r.realized_date=(b.cutoff at time zone 'Asia/Seoul')::date
 and (r.updated_at at time zone 'Asia/Seoul')::date=r.realized_date
 and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and regexp_replace(trim(r.provider_payload->>'shrt_is_cd'),'^A','')=k.asset_key
 and r.quantity>0 and r.sell_price>0 and r.sell_amount>0 and r.fee>=0 and r.tax>=0
 and abs(r.sell_amount-r.quantity*r.sell_price)<=r.quantity/2
 and r.sell_amount-r.buy_amount-r.fee-r.tax=r.realized_pnl
 and case when trim(r.provider_payload->>'ccls_q') ~ '^[0-9]+([.][0-9]+)?$'
 and trim(r.provider_payload->>'s_amt') ~ '^[0-9]+([.][0-9]+)?$'
 and trim(r.provider_payload->>'fee') ~ '^[0-9]+([.][0-9]+)?$'
 and trim(r.provider_payload->>'svrl_tx') ~ '^[0-9]+([.][0-9]+)?$'
 then trim(r.provider_payload->>'ccls_q')::numeric=r.quantity
 and trim(r.provider_payload->>'s_amt')::numeric=r.sell_amount
 and trim(r.provider_payload->>'fee')::numeric=r.fee and trim(r.provider_payload->>'svrl_tx')::numeric=r.tax else false end
 and not exists(select 1 from dated_transactions t join keys tk on tk.id=t.security_id
 where tk.asset_key=k.asset_key and t.type='sell'
 and coalesce(t.effective_at,t.trade_at)>=r.realized_date::timestamp at time zone 'Asia/Seoul')
 and not exists(select 1 from public.realized_pnl_events duplicate
 where duplicate.account_id=r.account_id and duplicate.security_id=r.security_id and duplicate.realized_date=r.realized_date
 and duplicate.provider_payload->>'trd_dl_ccd'='01' and duplicate.id<>r.id)
), overseas_pending as materialized (
 select e.asset_key,k.id as security_id,e.event_type as type,e.quantity,e.currency,e.order_date as day,
 false as provisional_date,case when e.event_type='buy' then -abs(e.gross_amount) else abs(e.gross_amount) end as cash,
 e.price
 from public.kb_position_evidence e join account a on a.id=e.account_id cross join bounds b
 join lateral(select k.id from keys k where k.asset_key=e.asset_key or k.symbol=e.symbol order by (k.asset_key=e.asset_key) desc limit 1) k on true
 where e.active and e.source='SPQM2205' and e.event_type in ('buy','sell')
 and e.order_date<=(b.cutoff at time zone 'Asia/Seoul')::date
 and not exists(select 1 from ledger t where t.asset_key=e.asset_key and t.type=e.event_type
 and t.quantity=e.quantity and t.ledger_day=e.settlement_date)
) , pending as materialized (
 select * from overseas_pending union all select * from domestic_pending
), trades as materialized (
 select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,false as pending,recovered_date,group_date_recovered,cash_verified from ledger
 union all select asset_key,security_id,type,quantity,currency,day,provisional_date,cash,price,true,null::date,false,currency='KRW' from pending
 union all select asset_key,security_id,'buy',quantity,'KRW',(acquired_at at time zone 'Asia/Seoul')::date,false,cash,price,false,null::date,false,true from verified_ipo
), period_trades as (
 select t.* from trades t cross join bounds b where t.day>=b.start_date
), ending as (
 select k.asset_key,(array_agg(h.security_id order by h.as_of desc))[1] security_id,
 sum(h.quantity) qty,sum(h.market_value) value_local,max(h.currency) currency,
 max(h.fx_rate_to_base) end_fx,min(h.as_of) as_of
 from public.holdings h join account a on a.id=h.account_id join keys k on k.id=h.security_id
 group by k.asset_key
), flows as (
 select t.asset_key,(array_agg(t.security_id order by t.day desc))[1] security_id,
 sum(case when t.type='buy' then t.quantity else -t.quantity end) delta,
 sum(t.cash) cash_local,sum(t.cash*f.rate) cash_krw,
 count(*) trades,count(*) filter(where t.pending) pending_count,
 count(*) filter(where t.provisional_date) provisional_count,
 count(*) filter(where t.recovered_date is not null) verified_date_count,
 count(*) filter(where t.group_date_recovered) grouped_date_count,
 count(*) filter(where t.cash is null or t.quantity<=0 or t.price<=0 or
 (abs(abs(t.cash)-t.quantity*t.price)>greatest(5,t.quantity*t.price*.05) and not t.cash_verified)) bad_amounts,
 count(*) filter(where f.rate is null) missing_fx
 from period_trades t
 left join lateral(select case when t.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=t.currency and x.quote_currency='KRW'
 and x.rate_date<=t.day and x.rate_date>=t.day-7 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
 group by t.asset_key
), dividend_receipts as materialized (
 -- Repair stale dividend identity only with a unique exact broker event match.
 select d.*,coalesce(m.security_id,d.security_id) resolved_security_id
 from public.dividends d join account a on a.id=d.account_id
 left join lateral (
 select (array_agg(t.security_id))[1] security_id from owned_transactions t join keys k on k.id=t.security_id
 where d.source='api' and t.source='api' and t.type='dividend'
 and d.external_id is not null and t.external_id=d.external_id
 and t.currency=d.currency and k.currency=d.currency and t.trade_at=d.paid_at and t.net_amount=d.net_amount
 and trim(t.provider_payload->>'stnd_is_cd')=k.asset_key
 having count(*)=1
 ) m on true
), dividends as (
 select k.asset_key,(array_agg(d.resolved_security_id order by d.paid_at desc))[1] security_id,
 sum(d.net_amount) local,sum(d.net_amount*f.rate) krw,
 count(*) filter(where f.rate is null) missing_fx
 from dividend_receipts d join keys k on k.id=d.resolved_security_id cross join bounds b
 left join lateral(select case when d.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=d.currency and x.quote_currency='KRW'
 and x.rate_date<=(d.paid_at at time zone 'Asia/Seoul')::date and x.rate_date>=(d.paid_at at time zone 'Asia/Seoul')::date-7
 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
 where (d.paid_at at time zone 'Asia/Seoul')::date>=b.start_date and d.paid_at<=b.cutoff group by k.asset_key
), ids as (
 select asset_key from ending where qty<>0 union select asset_key from flows union select asset_key from dividends
), positions as (
 select i.asset_key,k.id security_id,k.symbol,k.name,k.currency,
 coalesce(e.qty,0) end_qty,coalesce(e.qty,0)-coalesce(t.delta,0) start_qty,
 case when e.qty>0 then e.value_local else 0 end end_value,coalesce(t.cash_local,0) trade_cash,
 coalesce(t.cash_krw,0) trade_cash_krw,coalesce(d.local,0) dividend,coalesce(d.krw,0) dividend_krw,
 coalesce(t.trades,0) trade_count,coalesce(t.pending_count,0) pending_count,coalesce(t.provisional_count,0) provisional_count,
 coalesce(t.verified_date_count,0) verified_date_count,
 coalesce(t.grouped_date_count,0) grouped_date_count,
 coalesce(t.bad_amounts,0) bad_amounts,coalesce(t.missing_fx,0)+coalesce(d.missing_fx,0) missing_fx,
 e.end_fx,e.as_of,b.start_date,b.cutoff
 from ids i left join ending e using(asset_key) left join flows t using(asset_key) left join dividends d using(asset_key)
 join keys k on k.id=coalesce(e.security_id,t.security_id,d.security_id) cross join bounds b
), domestic_opening_settlement_checks as materialized (
 select p.asset_key,max(t.ledger_day) settled_through
 from positions p join ledger t on t.asset_key=p.asset_key
 and t.day<p.start_date and t.ledger_day>=p.start_date
 join lateral (
 select sum(h.quantity) quantity
 from public.daily_security_snapshots h join account a on a.id=h.account_id
 join keys k on k.id=h.security_id and k.asset_key=p.asset_key
 join public.daily_account_snapshots d on d.account_id=h.account_id and d.snapshot_date=h.snapshot_date
 where h.snapshot_date=p.start_date-1 and h.currency='KRW'
 having count(*)>0 and bool_and(h.updated_at=d.snapshot_at and h.quantity>0 and h.market_value>0 and h.fx_rate_to_base=1)
 ) snap on true
 where p.currency='KRW' and p_period<>'오늘' and p.start_qty>0
 group by p.asset_key,p.start_qty,snap.quantity
 having bool_and(t.currency='KRW' and not t.provisional_date and t.cash_verified
 and t.quantity>0 and t.price>0 and (t.recovered_date is not null or t.group_date_recovered))
 and sum(case when t.type='buy' then t.quantity else -t.quantity end)=p.start_qty-snap.quantity
 and p.start_qty<>snap.quantity
), native_opening_balance_checks as materialized (
 select distinct p.asset_key
 from positions p cross join account a
 -- Pick one response within the opening valuation window BEFORE expanding rows.
 -- The upper bound is exclusive: next-session premarket belongs to another valuation.
 join lateral (select public.read_batch_at_273(a.id::text,
 least(p.cutoff,((p.start_date+time '04:00') at time zone 'America/New_York')-interval '1 microsecond')) envelope) batch on true
 join lateral (
 select r.*,(batch.envelope->>'observed_at')::timestamptz observed_at
 from jsonb_to_recordset(case when (batch.envelope->>'complete')::boolean is true
 then batch.envelope->'rows' else '[]'::jsonb end)
 as r(symbol text,currency text,source text,effective_quantity numeric,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
 ) h on h.symbol=p.symbol and h.currency=p.currency
 join lateral (
 select coalesce(sum(e.quantity) filter(where e.event_type='buy'),0) buys,
 coalesce(sum(e.quantity) filter(where e.event_type='sell'),0) sells
 from public.kb_position_evidence e join account a on a.id=e.account_id
 where e.asset_key=p.asset_key and e.symbol=p.symbol and e.source='SPQM2205' and e.active
 and e.order_date<p.start_date and e.settlement_date>(h.observed_at at time zone 'Asia/Seoul')::date
 having count(*)>0 and bool_and(coalesce(e.currency='USD' and e.event_type in ('buy','sell')
 and e.quantity>0 and e.price>0 and e.evidence->>'occurrences'='1',false))
 and count(*)=count(distinct e.source_key)
 ) pending on true
 where p.currency='USD' and p.asset_key ~ '^US[A-Z0-9]{10}$'
 and p_period not in ('오늘','ALL') and p.start_qty>0 and p.provisional_count=0
 and h.source='SSQM2952' and h.effective_quantity=p.start_qty
 and h.settled_quantity>=0 and h.pending_buy_quantity>=0 and h.pending_sell_quantity>=0
 and h.effective_quantity=h.settled_quantity+h.pending_buy_quantity-h.pending_sell_quantity
 and h.pending_buy_quantity=pending.buys and h.pending_sell_quantity=pending.sells
 and (h.observed_at at time zone 'Asia/Seoul')::date=p.start_date and h.observed_at<=p.cutoff
 -- NY zone handles DST. Exclude observations before the prior extended session
 -- ends, and after the next premarket starts. Component equality rejects an
 -- overnight execution that has already entered the observed pending balance.
 and h.observed_at>=((p.start_date-1)+time '20:00') at time zone 'America/New_York'
 and h.observed_at<(p.start_date+time '04:00') at time zone 'America/New_York'
 and not exists(select 1 from dated_transactions t join keys k on k.id=t.security_id
 where k.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date between p.start_date-1 and p.start_date)
), opening_boundary_checks as materialized (
 -- A nearby snapshot can verify opening quantity after rolling back verified
 -- intervening trades. Its observation day must have no trades or corporate actions.
 select p.asset_key
 from positions p
 join public.daily_security_snapshots h on h.snapshot_date between p.start_date and p.start_date+3 and h.snapshot_date<=(p.cutoff at time zone 'Asia/Seoul')::date and h.currency=p.currency
 join account a on a.id=h.account_id
 join keys k on k.id=h.security_id and k.asset_key=p.asset_key
 join public.daily_account_snapshots d on d.account_id=h.account_id and d.snapshot_date=h.snapshot_date
 where (p.currency='USD' or (p.currency='KRW' and exists (
 select 1 from domestic_opening_settlement_checks dc where dc.asset_key=p.asset_key and dc.settled_through<=h.snapshot_date
 ))) and p_period<>'오늘' and p.start_qty>0 and p.provisional_count=0
 and not exists(select 1 from period_trades t where t.asset_key=p.asset_key and t.day=h.snapshot_date)
 and not exists(select 1 from dated_transactions t join keys tk on tk.id=t.security_id
 where tk.asset_key=p.asset_key and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date between p.start_date and h.snapshot_date)
 group by p.asset_key,p.start_qty,h.snapshot_date
 having sum(h.quantity)=p.start_qty+coalesce((select sum(case when t.type='buy' then t.quantity else -t.quantity end) from period_trades t where t.asset_key=p.asset_key and t.day<h.snapshot_date),0) and bool_and(h.updated_at=d.snapshot_at and h.quantity>0 and h.market_value>0)
), corporate_candidates as materialized (
 select k.asset_key,coalesce(t.effective_at,t.trade_at) event_at
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_ipo v where t.id=any(v.evidence_ids))
), evidence as materialized (
 select p.*,case when boundary.valid then q.close when snap.quantity>0 then snap.market_value/snap.quantity else q.close end opening_price,
 case when boundary.valid then q.price_date when snap.quantity>0 then p.start_date-1 else q.price_date end opening_date,
 case when boundary.valid then f.rate when snap.quantity>0 then snap.fx else f.rate end opening_fx,
 case when boundary.valid then 'historical_close_quantity_reconciled' when snap.quantity>0 then 'account_snapshot' else 'historical_close' end opening_basis,
 (snap.quantity is not null and abs(snap.quantity-p.start_qty)>.000001 and not boundary.valid) snapshot_quantity_mismatch,
 (p_period='오늘' and p.start_qty>0 and snap.quantity is null) today_snapshot_missing,
 exists(select 1 from corporate_candidates t where t.asset_key=p.asset_key
 and (t.event_at at time zone 'Asia/Seoul')::date>=p.start_date and t.event_at<=p.cutoff) corporate_event,
 (select min(x.qty) from (select p.start_qty+sum(d.delta) over(order by d.day) qty from
 (select t.day,sum(case when t.type='buy' then t.quantity else -t.quantity end) delta from period_trades t where t.asset_key=p.asset_key group by t.day) d) x) min_qty
 from positions p
 left join lateral(
 select sum(h.quantity) quantity,sum(h.market_value) market_value,min(h.fx_rate_to_base) fx
 from public.daily_security_snapshots h join account a on a.id=h.account_id
 join keys k on k.id=h.security_id
 join public.daily_account_snapshots d on d.account_id=h.account_id and d.snapshot_date=h.snapshot_date
 where k.asset_key=p.asset_key and h.snapshot_date=p.start_date-1 and h.currency=p.currency
 having count(*)>0 and bool_and(h.updated_at=d.snapshot_at and h.quantity>0 and h.market_value>0 and h.fx_rate_to_base>0)
 and min(h.fx_rate_to_base)=max(h.fx_rate_to_base)
 ) snap on true
 left join lateral(select x.close,x.price_date from public.daily_security_prices x join keys k on k.id=x.security_id
 where k.asset_key=p.asset_key and x.currency=p.currency and x.price_date<p.start_date and x.price_date>=p.start_date-7 and x.close>0
 order by x.price_date desc limit 1) q on p.start_qty>0
 left join lateral(select case when p.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=p.currency and x.quote_currency='KRW'
 and x.rate_date<p.start_date and x.rate_date>=p.start_date-7 and x.rate>0 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate) f on true
 cross join lateral(select coalesce(snap.quantity is not null and abs(snap.quantity-p.start_qty)>.000001
 and q.price_date=p.start_date-1 and q.close>0
 and (exists(select 1 from opening_boundary_checks bc where bc.asset_key=p.asset_key)
 or exists(select 1 from native_opening_balance_checks nb where nb.asset_key=p.asset_key)),false) valid) boundary
), classified as (
 select e.*,case when start_qty<-.000001 or min_qty<-.000001 then '수량 연결 확인 필요'
 when provisional_count>0 then '거래일 확인 필요'
 when snapshot_quantity_mismatch then '시작 보유수량 확인 필요'
 when today_snapshot_missing then '전날 잔고 관측 필요'
 when corporate_event then '분할·이관 확인 필요'
 when bad_amounts>0 then '거래 금액 확인 필요'
 when end_qty>0 and (end_value is null or as_of<cutoff-interval '1 day') then '마지막 잔고 확인 필요'
 when start_qty>0 and opening_price is null then '시작 가격 확인 필요'
 else null end issue,
 (currency='KRW' or (missing_fx=0 and (start_qty=0 or opening_fx is not null) and (end_qty=0 or end_fx is not null))) krw_ready
 from evidence e
), calculated as (
 select c.*,case when issue is null then end_value-case when start_qty>0 then start_qty*opening_price else 0 end+trade_cash+dividend end pnl_local,
 case when issue is null and krw_ready then end_value*coalesce(end_fx,1)-case when start_qty>0 then start_qty*opening_price*opening_fx else 0 end+trade_cash_krw+dividend_krw end pnl_krw
 from classified c
), gaps as (
 select count(*) n from dated_transactions t join account a on a.id=t.account_id cross join bounds b
 where t.security_id is null and t.type in ('buy','sell','dividend') and
 (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date and coalesce(t.effective_at,t.trade_at)<=b.cutoff
), closed_sources as (
 select k.asset_key,count(*) trades,count(*) filter(where t.type='sell') sales,
 count(*) filter(where t.effective_at is null) provisional,
 sum(t.net_amount) cash,
 bool_and(coalesce(t.source='api' and t.quantity>0 and t.fee is not null and t.tax is not null
 and case when trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then abs(abs(t.net_amount)-(replace(trim(t.provider_payload->>'dl_amt'),',','')::numeric+
 case when t.type='buy' then t.fee+t.tax else -t.fee-t.tax end))<=0.02 else false end
 and (t.type='buy' and t.net_amount<0 or t.type='sell' and t.net_amount>=0),false)) valid
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where t.type in ('buy','sell') and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date>=b.start_date
 and coalesce(t.effective_at,t.trade_at)<=b.cutoff group by k.asset_key
), closed_opening_quantities as materialized (
 select k.asset_key,coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0) quantity
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<b.start_date
 group by k.asset_key
), closed_cycles as (
 select c.asset_key,jsonb_build_object('method','flat_to_flat_net_cash','realized_local',z.cash,
 'realized_krw',c.trade_cash_krw,'sale_count',z.sales,'provisional_date_count',z.provisional) value
 from calculated c join closed_sources z using(asset_key)
 where c.issue is null and c.krw_ready and c.start_qty=0 and c.end_qty=0 and c.pending_count=0
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and 0=coalesce((select q.quantity from closed_opening_quantities q where q.asset_key=c.asset_key),0)
), split_records as materialized (
 select t.*,k.asset_key,(t.trade_at at time zone 'Asia/Seoul')::date split_day
 from dated_transactions t join keys k on k.id=t.security_id cross join bounds b
 where t.type in ('split_in','split_out') and (t.trade_at at time zone 'Asia/Seoul')::date>=b.start_date
 and t.trade_at<=b.cutoff
), verified_split_pairs as materialized (
 select asset_key,split_day,array_agg(id) evidence_ids,
 sum(quantity) filter(where type='split_out') outgoing_quantity,
 sum(case when type='split_in' then quantity else -quantity end) delta
 from split_records
 group by asset_key,split_day
 having count(*)=2 and count(*) filter(where type='split_in')=1 and count(*) filter(where type='split_out')=1
 and bool_and(coalesce(source='api' and currency<>'KRW' and quantity>0 and net_amount=0
 and trim(provider_payload->>'smry_nm')=case type when 'split_in' then '액면분할 입고' else '액면분할 출고' end
 and case when trim(replace(provider_payload->>'q',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(provider_payload->>'ec_amt') ~ '^0+$'
 then replace(trim(provider_payload->>'q'),',','')::numeric=quantity else false end,false))
 and sum(quantity) filter(where type='split_in')>sum(quantity) filter(where type='split_out')
), verified_split_history as materialized (
 select c.asset_key,z.cash+c.dividend pnl_local,'split_closed'::text basis
 from calculated c join closed_sources z using(asset_key)
 where (p_period='ALL' or c.provisional_count=0) and c.currency<>'KRW' and c.issue in ('거래일 확인 필요','분할·이관 확인 필요')
 and c.end_qty=0 and c.pending_count=0 and c.bad_amounts=0
 and not coalesce(c.snapshot_quantity_mismatch,false)
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and not exists(select 1 from verified_split_pairs v where v.asset_key=c.asset_key and v.outgoing_quantity<>
 coalesce((select sum(case when t.type='buy' then t.quantity else -t.quantity end) from period_trades t where t.asset_key=c.asset_key and t.day<v.split_day),0)+coalesce((select sum(v2.delta) from verified_split_pairs v2 where v2.asset_key=c.asset_key and v2.split_day<v.split_day),0))
 and c.start_qty=(select sum(v.delta) from verified_split_pairs v where v.asset_key=c.asset_key)
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key and t.type in ('buy','sell'))
 and not exists(select 1 from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key
 and t.type not in ('buy','sell','dividend','tax','fee','interest','fx','deposit','withdrawal')
 and not exists(select 1 from verified_split_pairs v where t.id=any(v.evidence_ids)))
 and 0<=(select min(qty) from (
 select sum(delta) over(order by day) qty from (
 select day,sum(delta) delta from (
 select t.day,case when t.type='buy' then t.quantity else -t.quantity end delta from period_trades t where t.asset_key=c.asset_key
 union all select v.split_day,v.delta from verified_split_pairs v where v.asset_key=c.asset_key
 ) events group by day) days) running)
), verified_plain_local_history as materialized (
 -- Whole-history, fully closed foreign positions need no intraday cost allocation.
 -- Missing execution dates still block KRW conversion and every bounded period.
 select c.asset_key,c.end_value+z.cash+c.dividend pnl_local,case when c.end_qty>0 then 'held' else 'closed' end basis
 from calculated c join closed_sources z using(asset_key)
 where p_period='ALL' and c.currency<>'KRW' and c.issue='거래일 확인 필요'
 and c.start_qty=0 and c.end_qty>=0 and c.pending_count=0
 and (c.end_qty=0 or (c.end_value>0 and c.as_of=c.cutoff))
 and c.min_qty>=0 and not c.corporate_event and c.bad_amounts=0
 and not coalesce(c.snapshot_quantity_mismatch,false)
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 -- Reject omitted earlier/later trades; never repair missing dates by inference.
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and t.type in ('buy','sell'))
), ledger_quantity_days as materialized (
 select k.asset_key,(t.trade_at at time zone 'Asia/Seoul')::date ledger_day,
 sum(case when t.type='buy' then t.quantity else -t.quantity end) delta,
 bool_and(coalesce(t.source='api' and t.quantity>0 and coalesce(t.effective_at,t.trade_at)<=b.cutoff
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt'),false)) source_valid
 from dated_transactions t join keys k on k.id=t.security_id cross join bounds b
 where p_period='ALL' and t.type in ('buy','sell') group by k.asset_key,(t.trade_at at time zone 'Asia/Seoul')::date
), ledger_quantity_evidence as materialized (
 select asset_key,min(qty) min_qty,sum(delta) final_qty,bool_and(source_valid) source_valid
 from (select d.*,sum(delta) over(partition by asset_key order by ledger_day) qty from ledger_quantity_days d) r group by asset_key
), verified_ledger_local_history as materialized (
 -- Entire closed ledger only: settlement chronology is not used as execution dates or FX dates.
 select c.asset_key,z.cash+c.dividend pnl_local,'ledger_closed'::text basis
 from calculated c join closed_sources z using(asset_key) join ledger_quantity_evidence q using(asset_key)
 where p_period='ALL' and c.currency<>'KRW' and c.issue='수량 연결 확인 필요'
 and c.start_qty=0 and c.end_qty=0 and c.pending_count=0
 and q.min_qty>=0 and q.final_qty=0 and q.source_valid
 and not c.corporate_event and c.bad_amounts=0 and not coalesce(c.snapshot_quantity_mismatch,false)
 and z.valid and z.sales>0 and z.trades=c.trade_count and z.cash=c.trade_cash
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key and t.type in ('buy','sell'))
), verified_local_history as materialized (
 select * from verified_plain_local_history union all select * from verified_split_history union all select * from verified_ledger_local_history
), result as (
 select count(*) candidates,count(pnl_local) included,count(pnl_krw) krw_included,sum(pnl_krw) total,
 sum(end_value*coalesce(end_fx,1)) filter(where pnl_krw is not null) ending_krw,
 sum(case when start_qty>0 then start_qty*opening_price*opening_fx else 0 end) filter(where pnl_krw is not null) opening_krw,
 sum(trade_cash_krw) filter(where pnl_krw is not null) trade_cash_krw,
 sum(dividend_krw) filter(where pnl_krw is not null) dividend_krw,
 coalesce(jsonb_agg(jsonb_build_object('security_id',security_id,'symbol',symbol,'name',name,'currency',currency,
 'ipo_acquisition',exists(select 1 from verified_ipo v where v.asset_key=calculated.asset_key),'closed_realized',(select z.value from closed_cycles z where z.asset_key=calculated.asset_key),'aliases',(select jsonb_agg(distinct k.symbol) from keys k where k.asset_key=calculated.asset_key),'pnl_local',coalesce(pnl_local,(select v.pnl_local from verified_local_history v where v.asset_key=calculated.asset_key)),'local_history_basis',(select v.basis from verified_local_history v where v.asset_key=calculated.asset_key),'local_cash_only',exists(select 1 from verified_local_history v where v.asset_key=calculated.asset_key),'pnl_krw',pnl_krw,'reason',issue,'start_quantity',case when exists(select 1 from verified_split_history v where v.asset_key=calculated.asset_key) then 0 else start_qty end,'end_quantity',end_qty,
 'opening_basis',opening_basis,'opening_price',opening_price,'opening_price_date',opening_date,'start_value_local',case when exists(select 1 from verified_split_history v where v.asset_key=calculated.asset_key) or start_qty=0 then 0 else start_qty*opening_price end,
 'end_value_local',end_value,'trade_cash_local',trade_cash,'dividend_local',dividend,'trade_count',trade_count,
 'provisional_amount',pending_count>0,'period_membership_only_count',case when p_period='ALL' then 0 else (select count(*) from domestic_period_membership pm join dated_transactions dt on dt.id=pm.transaction_id join keys dk on dk.id=dt.security_id where dk.asset_key=calculated.asset_key and dt.effective_at is null) end,'pending_count',pending_count,'provisional_date_count',provisional_count,'verified_date_count',verified_date_count,'grouped_date_count',grouped_date_count,'opening_fx',opening_fx,'end_fx',end_fx)
 order by abs(pnl_krw) desc nulls last,symbol),'[]'::jsonb) items from calculated
), domestic_totals as materialized (
 select asset_key,sum(corrected_cash) cash,count(*) n,bool_and(valid) valid
 from domestic_checked group by asset_key
), domestic_resolved as materialized (
 select c.asset_key,c.security_id,c.end_value+d.cash+coalesce(dp.cash,0)+c.dividend pnl,d.cash+coalesce(dp.cash,0) cash,c.end_value,c.dividend
 from calculated c join domestic_totals d using(asset_key) join ledger_quantity_evidence q using(asset_key)
 left join lateral(select count(*) n,sum(p.cash) cash,sum(p.quantity) sold from domestic_pending p where p.asset_key=c.asset_key) dp on true
 where p_period='ALL' and c.currency='KRW' and c.issue in ('거래 금액 확인 필요','거래일 확인 필요')
 and c.start_qty=0 and c.end_qty>=0 and c.pending_count=coalesce(dp.n,0) and not c.corporate_event
 and not coalesce(c.snapshot_quantity_mismatch,false)
 and q.source_valid and q.min_qty>=0 and q.final_qty-coalesce(dp.sold,0)=c.end_qty
 and (c.end_qty=0 or (c.end_value>0 and c.as_of=c.cutoff))
 and d.valid and d.n+coalesce(dp.n,0)=c.trade_count
), pending_checks as materialized (
 select p.asset_key,count(*) n,sum(p.cash) cash,
 bool_and(coalesce(e.quantity>0 and e.price>0 and e.gross_amount>0 and e.currency='USD'
 and e.evidence->>'source'='SPQM2205'
 and e.evidence->>'order_date'=e.order_date::text and e.evidence->>'settlement_date'=e.settlement_date::text
 -- Settlement day remains provisional until a matching ledger event arrives.
 and e.settlement_date>=(b.cutoff at time zone 'Asia/Seoul')::date
 and e.settlement_date between e.order_date and e.order_date+10
 and (e.fetched_at at time zone 'Asia/Seoul')::date=(b.cutoff at time zone 'Asia/Seoul')::date
 and abs(e.gross_amount-e.quantity*e.price)<=greatest(5,e.quantity*e.price*.01),false)) valid
 from pending p cross join bounds b join public.kb_position_evidence e on e.asset_key=p.asset_key
 and e.event_type=p.type and e.order_date=p.day and e.quantity=p.quantity and e.price=p.price
 and e.gross_amount=abs(p.cash) and e.active and e.source='SPQM2205'
 join account a on a.id=e.account_id group by p.asset_key
), pending_resolved as materialized (
 select c.asset_key,c.security_id,c.end_value+z.cash+p.cash+c.dividend pnl
 from calculated c join closed_sources z using(asset_key) join pending_checks p using(asset_key)
 join ledger_quantity_evidence q using(asset_key)
 where p_period='ALL' and c.currency='USD' and c.issue='거래일 확인 필요'
 and c.start_qty=0 and c.end_qty>=0 and c.pending_count>0 and p.n=c.pending_count and p.valid
 and c.min_qty>=0 and q.min_qty>=0 and q.source_valid
 and not c.corporate_event and c.bad_amounts=0 and not coalesce(c.snapshot_quantity_mismatch,false)
 and (c.end_qty=0 or (c.end_value>0 and c.as_of=c.cutoff))
 and z.valid and z.trades+p.n=c.trade_count and z.cash+p.cash=c.trade_cash
 and z.trades=(select count(*) from dated_transactions t join keys k on k.id=t.security_id where k.asset_key=c.asset_key and t.type in ('buy','sell'))
), corporate_catalog(group_key,old_key,new_key,ratio,event_date,out_kind,in_kind) as (
 -- Public issuer/SEC notices, not inferred from account quantities. See build125 docs.
 values ('MSTY','US88634T4931','US88636X7324',.2::numeric,date '2025-12-08','액면병합 출고','액면병합 입고'),
 ('SOXS','US25461H5726','US25461H2913',.1::numeric,date '2026-07-15','액면병합 출고','액면병합 입고'),
 ('OUST','US92259F1012','US68989M1036',.8204::numeric,date '2023-02-10','외화증권상환 출고','외화증권기타 입고'),
 ('OUST','US68989M1036','US68989M2026',.1::numeric,date '2023-04-20','액면병합 출고','액면병합 입고')
), corporate_members as (
 select group_key,old_key asset_key from corporate_catalog union select group_key,new_key from corporate_catalog
), corporate_records as materialized (
 select m.group_key,k.asset_key,t.*,(t.trade_at at time zone 'Asia/Seoul')::date ledger_date,
 trim(t.provider_payload->>'smry_nm') kind
 from dated_transactions t join keys k on k.id=t.security_id join corporate_members m using(asset_key)
), corporate_pairs as materialized (
 select c.*,o.id out_id,i.id in_id,o.quantity outgoing,i.quantity incoming,o.ledger_date
 from corporate_catalog c join corporate_records o on o.asset_key=c.old_key and o.kind=c.out_kind
 join corporate_records i on i.asset_key=c.new_key and i.kind=c.in_kind and i.ledger_date=o.ledger_date
 where o.ledger_date between c.event_date and c.event_date+10
 and o.type in ('split_out','corporate_out') and i.type in ('split_in','transfer_in')
 and o.source='api' and i.source='api' and o.currency='USD' and i.currency='USD'
 and o.net_amount=0 and i.net_amount=0 and o.fee=0 and i.fee=0 and o.tax=0 and i.tax=0 and o.quantity>0 and i.quantity>0
 and i.quantity=floor(o.quantity*c.ratio)
 and (select count(*) from corporate_records x where x.asset_key=c.old_key and x.kind=c.out_kind)=1
 and (select count(*) from corporate_records x where x.asset_key=c.new_key and x.kind=c.in_kind)=1
 and case when trim(replace(o.provider_payload->>'q',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 and trim(replace(i.provider_payload->>'q',',','')) ~ '^[0-9]+([.][0-9]+)?$'
 then replace(trim(o.provider_payload->>'q'),',','')::numeric=o.quantity
 and replace(trim(i.provider_payload->>'q'),',','')::numeric=i.quantity else false end
 and trim(o.provider_payload->>'ec_amt') ~ '^0+$' and trim(i.provider_payload->>'ec_amt') ~ '^0+$'
), corporate_quantities as materialized (
 select group_key,asset_key,sum(delta) final_qty,min(qty) min_qty
 from (select d.*,sum(delta) over(partition by group_key,asset_key order by ledger_date) qty
 from (select group_key,asset_key,ledger_date,sum(case when type in ('buy','split_in','transfer_in') then quantity
 when type in ('sell','split_out','corporate_out') then -quantity else 0 end) delta
 from corporate_records group by group_key,asset_key,ledger_date) d) r group by group_key,asset_key
), corporate_extra as materialized (
 select group_key,
 coalesce(sum(net_amount) filter(where currency='USD'),0) cash,
 coalesce(sum(net_amount) filter(where currency='USD' and type='other'),0) fraction_cash,
 coalesce(sum(net_amount) filter(where currency='USD' and type='tax'),0) tax_cash,
 coalesce(sum(net_amount) filter(where currency='KRW'),0) krw_cash,
 bool_and(coalesce(source='api' and case when currency='USD' then
 case when trim(provider_payload->>'fcrncy_amt') ~ '^[0-9]+([.][0-9]+)?$'
 then abs(net_amount)=trim(provider_payload->>'fcrncy_amt')::numeric else false end
 when currency='KRW' then case when trim(provider_payload->>'ec_amt') ~ '^[0-9]+([.][0-9]+)?$'
 then -net_amount=trim(provider_payload->>'ec_amt')::numeric else false end else false end
 and (kind in ('단수주매각대금 입금','해외원천세 환급 입금') and net_amount>=0 or kind in ('해외원천세 출금','배당세금추징 출금') and net_amount<=0),false)) valid
 from corporate_records cross join bounds b where type in ('other','tax') and ledger_date>=b.start_date and trade_at<=b.cutoff group by group_key
), corporate_resolved as materialized (
 select m.group_key,array_agg(c.security_id) ids,array_agg(c.asset_key) asset_keys,
 sum(c.trade_cash) trade_cash,sum(c.dividend) dividend,sum(op.opening_value) opening_value,
 sum(c.end_value+c.trade_cash+c.dividend-op.opening_value)+coalesce(x.cash,0) pnl,
 sum(c.end_qty) end_qty,sum(c.end_value) end_value,sum(c.pending_count) pending_count,
 coalesce(x.cash,0) extra_cash,coalesce(x.krw_cash,0) extra_krw,coalesce(x.fraction_cash,0) fraction_cash,coalesce(x.tax_cash,0) tax_cash,sum(c.trade_count) trade_count,sum(c.provisional_count) provisional_dates
 from corporate_members m join calculated c using(asset_key) left join closed_sources z using(asset_key)
 join corporate_quantities q using(group_key,asset_key) left join corporate_extra x using(group_key)
 left join pending_checks pc on pc.asset_key=c.asset_key
 left join lateral (
   select coalesce(sum(case when p.type='buy' then p.quantity else -p.quantity end),0) delta,
   min(p.day) first_day
   from pending p where p.asset_key=c.asset_key
 ) pd on true
 cross join bounds b
 cross join lateral(select case when p_period='ALL' then 0 else c.start_qty-coalesce((
 select sum(case when r.type in ('split_in','transfer_in') then r.quantity when r.type in ('split_out','corporate_out') then -r.quantity else 0 end)
 from corporate_records r where r.asset_key=c.asset_key and r.ledger_date>=b.start_date and r.trade_at<=b.cutoff),0) end qty) oq
 left join lateral(select p.close from public.corporate_unadjusted_prices p
 where p.symbol=m.group_key and p.currency='USD' and p.source='kb_gsc10060_unadjusted'
 and p.price_date<b.start_date and p.price_date>=b.start_date-7 order by p.price_date desc limit 1) price on oq.qty>0
 cross join lateral(select case when oq.qty=0 then 0 else oq.qty*price.close end opening_value) op
 group by m.group_key,x.cash,x.krw_cash,x.valid,x.fraction_cash,x.tax_cash
 having count(*)=(select count(*) from corporate_members m2 where m2.group_key=m.group_key)
 and (select count(*) from corporate_pairs p where p.group_key=m.group_key)=(select count(*) from corporate_catalog p where p.group_key=m.group_key)
 and bool_and(c.currency='USD' and c.end_qty>=0 and c.bad_amounts=0
 and oq.qty>=0 and op.opening_value is not null
 and (p_period='ALL' or (c.provisional_count=0 and m.group_key in ('MSTY','SOXS')
 and (select count(*) from corporate_catalog cat where cat.group_key=m.group_key)=1))
 and (c.end_qty=0 or (c.end_value>0 and c.as_of=c.cutoff))
 and (c.pending_count=0 or (pc.valid and pc.n=c.pending_count
 and pd.first_day >= (select max(t.ledger_date) from corporate_records t where t.asset_key=c.asset_key)))
 and coalesce(z.valid,c.trade_count=0) and coalesce(z.trades,0)+coalesce(pc.n,0)=c.trade_count
 and coalesce(z.cash,0)+coalesce(pc.cash,0)=c.trade_cash
 and q.final_qty+pd.delta=c.end_qty and q.min_qty>=0
 and not exists(select 1 from (
   select q.final_qty+sum(d.delta) over(order by d.day) qty
   from (select p.day,sum(case when p.type='buy' then p.quantity else -p.quantity end) delta
     from pending p where p.asset_key=c.asset_key group by p.day) d
 ) running where qty<0))
 and coalesce(x.valid,true)
 and not exists(select 1 from corporate_records t where t.group_key=m.group_key and
 (t.trade_at>max(b.cutoff) or to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')<>trim(t.provider_payload->>'dl_dt')
 or t.type not in ('buy','sell','dividend','tax','other') and not exists(select 1 from corporate_pairs p where t.id in (p.in_id,p.out_id))
 or t.type='other' and t.kind<>'단수주매각대금 입금'
 or t.type='tax' and t.kind not in ('해외원천세 출금','해외원천세 환급 입금','배당세금추징 출금')))
 -- Dividend rows must match cash-ledger receipts before adding separate tax movements.
 and sum(c.dividend)=(select coalesce(sum(t.net_amount),0) from corporate_records t where t.group_key=m.group_key and t.type='dividend' and t.currency='USD' and t.ledger_date>=min(b.start_date) and t.trade_at<=max(b.cutoff))
), resolved_items as materialized (
 select item || coalesce((select jsonb_build_object('pnl_local',d.pnl,'pnl_krw',d.pnl,'reason',null,
 'trade_cash_local',d.cash,'whole_history_cash',true) from domestic_resolved d where d.security_id::text=item->>'security_id'),'{}'::jsonb)
 || coalesce((select jsonb_build_object('pnl_local',p.pnl,'local_cash_only',true,'local_history_basis','pending',
 'provisional_amount',true) from pending_resolved p where p.security_id::text=item->>'security_id'),'{}'::jsonb) item
 from result r cross join lateral jsonb_array_elements(r.items) item
 where not exists(select 1 from corporate_resolved g where (item->>'security_id')::uuid=any(g.ids))
 union all
 select item || jsonb_build_object('symbol',g.group_key,'name',(item->>'name')||' · 이전 종목 통합','pnl_local',g.pnl,'pnl_krw',null,
 'local_cash_only',true,'local_history_basis','corporate_group','start_quantity',case when g.opening_value=0 then 0 else null end,'end_quantity',g.end_qty,
 'start_value_local',g.opening_value,'end_value_local',g.end_value,'pending_count',g.pending_count,'provisional_amount',g.pending_count>0,'trade_cash_local',g.trade_cash,'dividend_local',g.dividend,
 'corporate_realized_local',case when g.opening_value=0 and g.end_qty=0 and g.pending_count=0 then g.trade_cash+g.fraction_cash end,'corporate_distribution_local',g.dividend+g.tax_cash,
 'corporate_cash_local',g.extra_cash,'separate_cash_krw',g.extra_krw,'trade_count',g.trade_count,
 'provisional_date_count',g.provisional_dates,'merged_security_count',cardinality(g.ids),'aliases',(select jsonb_agg(distinct k.symbol) from keys k where k.asset_key=any(g.asset_keys)))
 from result r cross join lateral jsonb_array_elements(r.items) item join corporate_resolved g on (item->>'security_id')::uuid=(select c.security_id from calculated c join corporate_catalog cat on cat.new_key=c.asset_key and cat.group_key=g.group_key where not exists(select 1 from corporate_catalog later where later.group_key=g.group_key and later.old_key=c.asset_key) order by c.security_id limit 1)
), distribution_records as materialized (
 -- Whole-history correction: validate each cash event before applying any tax.
 select t.*,k.asset_key,trim(t.provider_payload->>'smry_nm') kind,
 case when t.currency='KRW' then 1::numeric else
 (select x.rate from public.fx_rates x where x.base_currency=t.currency and x.quote_currency='KRW'
 and x.rate_date<=(t.trade_at at time zone 'Asia/Seoul')::date
 and x.rate_date>=(t.trade_at at time zone 'Asia/Seoul')::date-7 and x.rate>0
 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) end rate,
 coalesce(t.source='api' and t.external_id like 'KB:SWQA2301:%'
 and to_char(t.trade_at at time zone 'Asia/Seoul','YYYYMMDD')=trim(t.provider_payload->>'dl_dt')
 and trim(t.provider_payload->>'stnd_is_cd')=k.asset_key
 and case when t.currency='USD' then
 trim(t.provider_payload->>'crncy_clsf_nm')='USD' and
 case when trim(t.provider_payload->>'fcrncy_amt') ~ '^[0-9]+([.][0-9]+)?$'
 then abs(t.net_amount)=trim(t.provider_payload->>'fcrncy_amt')::numeric else false end
 when t.currency='KRW' then
 case when trim(t.provider_payload->>'ec_amt') ~ '^[0-9]+([.][0-9]+)?$'
 then -t.net_amount=trim(t.provider_payload->>'ec_amt')::numeric else false end else false end
 and case when t.type='dividend' then t.currency='USD' and t.net_amount>=0 and trim(t.provider_payload->>'smry_nm')='배당금 입금'
 when t.type='tax' then
 (t.currency='USD' and (trim(t.provider_payload->>'smry_nm')='해외원천세 출금' and t.net_amount<=0
 or trim(t.provider_payload->>'smry_nm')='해외원천세 환급 입금' and t.net_amount>=0))
 or (t.currency='KRW' and trim(t.provider_payload->>'smry_nm')='배당세금추징 출금' and t.net_amount<=0)
 else false end,false) valid
 from owned_transactions t join keys k on k.id=t.security_id cross join bounds b
 where p_period='ALL' and k.currency='USD' and t.type in ('dividend','tax') and t.trade_at<=b.cutoff
 and (t.trade_at at time zone 'Asia/Seoul')::date>=b.start_date
), distribution_adjustments as materialized (
 select c.security_id,c.asset_key,
 coalesce(sum(t.net_amount) filter(where t.type='tax' and t.currency='USD'),0) tax_local,
 coalesce(sum(t.net_amount) filter(where t.type='tax' and t.currency='KRW'),0) tax_krw,
 coalesce(sum(t.net_amount*t.rate) filter(where t.type='tax'),0) converted_tax,
 count(*) filter(where t.type='tax' and t.rate is null) missing_fx,
 count(*) filter(where t.type='tax') tax_events
 from calculated c join distribution_records t using(asset_key)
 where not exists(select 1 from corporate_resolved g where c.asset_key=any(g.asset_keys))
 group by c.security_id,c.asset_key,c.dividend
 having bool_and(t.valid) and count(*) filter(where t.type='tax')>0
 -- Only gross ledger receipts may receive the separate withholding adjustment.
 and count(*) filter(where t.type='dividend')>0
 and c.dividend=sum(t.net_amount) filter(where t.type='dividend')
 and count(*) filter(where t.type='dividend')=(select count(*) from dividend_receipts d join keys k on k.id=d.resolved_security_id cross join bounds b
 where k.asset_key=c.asset_key and d.paid_at<=b.cutoff and (d.paid_at at time zone 'Asia/Seoul')::date>=b.start_date
 and d.gross_amount=d.net_amount and coalesce(d.tax,0)=0 and d.currency='USD')
), taxed_items as materialized (
 select r.item || coalesce((select jsonb_build_object(
 'pnl_local',(r.item->>'pnl_local')::numeric+a.tax_local,
 'pnl_krw',case when a.missing_fx=0 then (r.item->>'pnl_krw')::numeric+a.converted_tax end,
 'dividend_local',(r.item->>'dividend_local')::numeric+a.tax_local,
 'distribution_tax_local',a.tax_local,'distribution_tax_events',a.tax_events,
 'separate_cash_krw',case when r.item->>'pnl_krw' is null or a.missing_fx>0 then a.tax_krw else 0 end,
 'local_cash_only',case when r.item->>'pnl_krw' is not null and a.missing_fx>0 then true else coalesce((r.item->>'local_cash_only')::boolean,false) end,
 'distribution_tax_verified',true)
 from distribution_adjustments a where a.security_id::text=r.item->>'security_id'),'{}'::jsonb) item
 from resolved_items r
), reference_members as materialized (
 -- A reference conversion never changes the verified native-currency result.
 select r.item->>'security_id' row_id,k.asset_key
 from taxed_items r join keys k on k.id::text=r.item->>'security_id'
 where r.item->>'local_cash_only'='true' and r.item->>'pnl_krw' is null
 and r.item->>'local_history_basis'<>'corporate_group'
 union all
 select r.item->>'security_id',unnest(g.asset_keys)
 from taxed_items r join corporate_resolved g on (r.item->>'security_id')::uuid=any(g.ids)
 where r.item->>'local_history_basis'='corporate_group'
), reference_cash as materialized (
 select asset_key,currency,cash,case when provisional_date then ledger_day else day end as day,
 provisional_date as ledger_date_basis
 from ledger where currency='USD'
 union all
 select asset_key,currency,cash,day,false from pending where currency='USD'
 union all
 select k.asset_key,d.currency,d.net_amount,(d.paid_at at time zone 'Asia/Seoul')::date,false
 from dividend_receipts d join keys k on k.id=d.resolved_security_id cross join bounds b
 where d.currency='USD' and d.paid_at<=b.cutoff
 and (d.paid_at at time zone 'Asia/Seoul')::date>=b.start_date
 union all
 select asset_key,currency,net_amount,(trade_at at time zone 'Asia/Seoul')::date,false
 from distribution_records where type='tax' and currency='USD' and valid
 union all
 select asset_key,currency,net_amount,ledger_date,false from corporate_records
 where type='other' and currency='USD' and kind='단수주매각대금 입금'
), reference_rates as materialized (
 select t.*,f.rate from reference_cash t
 left join lateral(select x.rate from public.fx_rates x
 where x.base_currency=t.currency and x.quote_currency='KRW' and x.rate>0
 and x.rate_date<=t.day and x.rate_date>=t.day-7
 order by x.rate_date desc,(x.source='kb_account_snapshot') desc nulls last,x.observed_at desc nulls last,x.source,x.rate desc limit 1) f on true
), reference_conversions as materialized (
 select r.item->>'security_id' row_id,
 sum(t.cash*t.rate)+case when (r.item->>'end_value_local')::numeric=0 then 0
 else (r.item->>'end_value_local')::numeric*(r.item->>'end_fx')::numeric end amount,
 count(*) filter(where t.ledger_date_basis) ledger_dates
 from taxed_items r join reference_members m on m.row_id=r.item->>'security_id'
 join reference_rates t using(asset_key)
 where p_period='ALL' and r.item->>'currency'='USD' and r.item->>'pnl_local' is not null
 group by r.item
 having bool_and(t.rate is not null and t.rate>0)
 and (coalesce((r.item->>'end_value_local')::numeric=0,false) or
 ((r.item->>'end_value_local')::numeric>0 and (r.item->>'end_fx')::numeric>0))
 -- Reject omitted/duplicated events, unaccounted transfers, and incomplete source coverage.
 and abs(sum(t.cash)+(r.item->>'end_value_local')::numeric-(r.item->>'pnl_local')::numeric)<0.005
), calculated_reference_items as materialized (
 select r.item || coalesce((select jsonb_build_object('reference_pnl_krw',c.amount,
 'reference_fx_basis','event_date_with_ledger_fallback','reference_ledger_date_count',c.ledger_dates)
 from reference_conversions c where c.row_id=r.item->>'security_id'),'{}'::jsonb) item from taxed_items r
), official_only_candidates as materialized (
 select distinct on (k.asset_key) k.id,k.asset_key,k.symbol,k.name,k.currency
 from public.realized_pnl_events e join account a on a.id=e.account_id
 join keys k on k.id=e.security_id cross join bounds b
 where e.source='api' and e.currency='KRW' and k.currency='KRW'
 and e.provider_event_id like 'KB:SSQM2442:%' and e.quantity>0
 and e.provider_payload->>'trd_dl_ccd' in ('01','02')
 and to_char(e.realized_date,'YYYYMMDD')=trim(e.provider_payload->>'trd_dt')
 and e.realized_date between b.start_date and (b.cutoff at time zone 'Asia/Seoul')::date
 and not exists(select 1 from calculated_reference_items c where
   regexp_replace(c.item->>'symbol','^A([0-9][A-Z0-9]{5})$','\1')=k.asset_key
   or exists(select 1 from jsonb_array_elements_text(coalesce(c.item->'aliases','[]'::jsonb)) z(alias)
     where regexp_replace(z.alias,'^A([0-9][A-Z0-9]{5})$','\1')=k.asset_key))
 order by k.asset_key,k.id
), reference_items as materialized (
 select item from calculated_reference_items
 union all
 select jsonb_build_object('security_id',id,'symbol',symbol,'name',name,'currency',currency,
 'aliases',jsonb_build_array(asset_key,'A'||asset_key),
 'pnl_krw',null,'pnl_local',null,'reason','결제 원장 연결 확인 필요',
 'official_only',true,'provisional_amount',true,'trade_count',0,'pending_count',0)
 from official_only_candidates
), resolved_totals as (
 select count(*) candidates,count(*) filter(where item->>'pnl_local' is not null) included,
 count(*) filter(where item->>'pnl_krw' is not null) krw_included,
 count(*) filter(where item->>'local_cash_only'='true') local_only,
 count(*) filter(where item->>'provisional_amount'='true') provisional,
 sum((item->>'pnl_krw')::numeric) total,coalesce(jsonb_agg(item order by abs((item->>'pnl_krw')::numeric) desc nulls last,item->>'symbol'),'[]'::jsonb) items
 from reference_items
), resolved_patch as (
 select jsonb_build_object('items',t.items,'candidate_count',t.candidates,'source_candidate_count',r.candidates,
 'included_count',t.included,'krw_included_count',t.krw_included,'local_only_count',t.local_only,
 'provisional_count',t.provisional,'pnl_krw',t.total,'all_items_displayed',t.included=t.candidates,
 'complete',t.candidates>0 and t.krw_included=t.candidates and (select n from gaps)=0,
 'calculation',jsonb_build_object('opening_krw',r.opening_krw,
 'ending_krw',coalesce(r.ending_krw,0)+(select coalesce(sum(end_value),0) from domestic_resolved),
 'net_trade_cash_krw',coalesce(r.trade_cash_krw,0)+(select coalesce(sum(cash),0) from domestic_resolved),
 'dividend_krw',coalesce(r.dividend_krw,0)+(select coalesce(sum(dividend),0) from domestic_resolved)+(select coalesce(sum(a.converted_tax),0) from distribution_adjustments a join calculated c using(security_id) where c.pnl_krw is not null and a.missing_fx=0),
 'difference_krw',t.total-(coalesce(r.ending_krw,0)-coalesce(r.opening_krw,0)+coalesce(r.trade_cash_krw,0)+coalesce(r.dividend_krw,0)+(select coalesce(sum(a.converted_tax),0) from distribution_adjustments a join calculated c using(security_id) where c.pnl_krw is not null and a.missing_fx=0)+(select coalesce(sum(pnl),0) from domestic_resolved)))) patch
 from resolved_totals t cross join result r
)

select jsonb_build_object('ok',exists(select 1 from account),'period',p_period,'period_start',b.start_date,
 'period_end',(b.cutoff at time zone 'Asia/Seoul')::date,'basis_at',b.cutoff,'scope','KB 종합위탁 · 주식',
 'method','ending_minus_opening_plus_net_trades_dividends','included_count',r.included,'candidate_count',r.candidates,
 'local_only_count',(select count(*) from verified_local_history),'krw_included_count',r.krw_included,'pnl_krw',r.total,'complete',r.candidates>0 and r.krw_included=r.candidates and (select n from gaps)=0,'unmapped_count',(select n from gaps),
 'calculation',jsonb_build_object('opening_krw',r.opening_krw,'ending_krw',r.ending_krw,'net_trade_cash_krw',r.trade_cash_krw,'dividend_krw',r.dividend_krw,'difference_krw',r.total-(r.ending_krw-r.opening_krw+r.trade_cash_krw+r.dividend_krw)),'items',r.items,'krw_basis','거래일별 참고 환율 · 현금 환차손익 별도') || coalesce((select patch from resolved_patch),'{}'::jsonb) || jsonb_build_object('comparison_fx_at',b.cutoff,'comparison_fx',coalesce((select jsonb_object_agg(f.currency,f.rate) from (
 select h.currency,min(h.fx_rate_to_base) rate from public.holdings h join account a on a.id=h.account_id
 where h.as_of=b.cutoff and h.currency<>'KRW' group by h.currency
 having bool_and(h.fx_rate_to_base is not null and h.fx_rate_to_base>0) and min(h.fx_rate_to_base)=max(h.fx_rate_to_base)
 ) f),'{}'::jsonb)) from result r cross join bounds b
) calculation(result);
$function$;


-- Separately inspect a zero-net ledger span. A missing broker opening balance
-- is never upgraded to a verified closed-cycle P/L merely because net=0.
create or replace function public.get_live_realized_cycle_review(p_symbol text)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_security uuid;
  v_first date;
  v_last date;
  v_buys numeric;
  v_sells numeric;
  v_buy_cost numeric;
  v_sale_net numeric;
  v_bad integer;
  v_corporate integer;
  v_currency text;
  v_currency_count integer;
  v_months integer;
  v_incomplete integer;
  v_opening boolean;
  v_ending boolean;
  v_days jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if upper(trim(coalesce(p_symbol,''))) !~ '^[A-Z0-9.]{1,15}$'
    then raise exception 'invalid symbol'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.provider='kb_securities'
      and a.mode='live' and a.is_active order by a.created_at limit 1;
  select s.id into v_security from public.securities s
    where s.symbol=upper(trim(p_symbol)) and exists(select 1 from public.transactions t
      where t.account_id=v_account and t.security_id=s.id) order by s.id limit 1;
  if v_security is null then return jsonb_build_object('ok',false,'reason','NO_OWNER_TRADES'); end if;
  select min((coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date),
      max((coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date),
      coalesce(sum(t.quantity) filter(where t.type='buy'),0),
      coalesce(sum(t.quantity) filter(where t.type='sell'),0),
      coalesce(sum(-t.net_amount) filter(where t.type='buy'),0),
      coalesce(sum(t.net_amount) filter(where t.type='sell'),0),
      count(*) filter(where t.source<>'api' or t.quantity is null or t.quantity<=0
        or t.net_amount is null or t.fee is null or t.tax is null or
        trim(replace(coalesce(t.provider_payload->>'dl_amt',''),',',''))
          !~ '^[0-9]+(\.[0-9]+)?$'),
      count(*) filter(where t.type not in ('buy','sell','dividend','fee','tax','interest')),
      min(t.currency) filter(where t.type in ('buy','sell')),
      count(distinct t.currency) filter(where t.type in ('buy','sell'))
    into v_first,v_last,v_buys,v_sells,v_buy_cost,v_sale_net,v_bad,v_corporate,
      v_currency,v_currency_count
    from public.transactions t where t.account_id=v_account and t.security_id=v_security;
  select count(*),count(*) filter(where m.completed_at is null or m.ledger_rows is null)
    into v_months,v_incomplete from public.kb_backfill_months m
    where m.user_id=(select auth.uid()) and m.month<=date_trunc('month',v_last)::date;
  select coalesce((b.j->>'complete')::boolean,false)
    and (b.j->>'observed_at')::timestamptz >= ((v_first-1)::timestamp at time zone 'Asia/Seoul')
    and (b.j->>'observed_at')::timestamptz < (v_first::timestamp at time zone 'Asia/Seoul')
    and not exists(select 1 from jsonb_to_recordset(coalesce(b.j->'rows','[]'::jsonb))
      as r(symbol text,currency text,source text,effective_quantity numeric,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
      where r.symbol=upper(trim(p_symbol)) and (
        r.currency is distinct from v_currency or r.source is distinct from 'SSQM2952'
        or r.effective_quantity is distinct from 0::numeric
        or r.settled_quantity is null or r.pending_buy_quantity is null or r.pending_sell_quantity is null
        or r.effective_quantity is distinct from r.settled_quantity+r.pending_buy_quantity-r.pending_sell_quantity))
    into v_opening from (select public.read_batch_at_273(v_account::text,(v_first::timestamp at time zone 'Asia/Seoul')-interval '1 microsecond') j) b;
  select coalesce((b.j->>'complete')::boolean,false)
    and (b.j->>'observed_at')::timestamptz >= ((v_last+1)::timestamp at time zone 'Asia/Seoul')
    and (b.j->>'observed_at')::timestamptz < now()+interval '1 microsecond'
    and not exists(select 1 from jsonb_to_recordset(coalesce(b.j->'rows','[]'::jsonb))
      as r(symbol text,currency text,source text,effective_quantity numeric,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
      where r.symbol=upper(trim(p_symbol)) and (
        r.currency is distinct from v_currency or r.source is distinct from 'SSQM2952'
        or r.effective_quantity is distinct from 0::numeric
        or r.settled_quantity is null or r.pending_buy_quantity is null or r.pending_sell_quantity is null
        or r.effective_quantity is distinct from r.settled_quantity+r.pending_buy_quantity-r.pending_sell_quantity))
    into v_ending from (select public.read_batch_at_273(v_account::text,now()) j) b;
  select coalesce(jsonb_agg(d.event_day order by d.event_day),'[]'::jsonb) into v_days from (
    select (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date event_day
    from public.transactions t where t.account_id=v_account and t.security_id=v_security
      and t.type in ('buy','sell') group by 1 having count(distinct t.type)>1
  ) d;
  return jsonb_build_object('ok',true,'symbol',upper(trim(p_symbol)),
    'account_scope','kb_securities_auto','first_order_or_ledger_date',v_first,
    'last_order_or_ledger_date',v_last,'buy_quantity',v_buys,'sell_quantity',v_sells,
    'buy_cost',v_buy_cost,'sell_net',v_sale_net,
    'ledger_net_quantity',v_buys-v_sells,'source_missing_count',v_bad,
    'corporate_or_transfer_event_count',v_corporate,
    'backfill_months',v_months,'backfill_incomplete_months',v_incomplete,
    'opening_zero_verified',v_opening,'ending_zero_verified',v_ending,
    'mixed_days',v_days,'candidate_currency',case when v_currency_count=1 then v_currency else null end,
    'candidate_cash_difference',case when v_bad=0 and v_corporate=0
      and v_buys=v_sells and v_incomplete=0 and v_currency_count=1
      then v_sale_net-v_buy_cost else null end,
    'status',case when v_bad=0 and v_corporate=0 and v_buys=v_sells and v_currency_count=1
      and v_incomplete=0 and v_opening and v_ending then 'closed_cycle_verified'
      when v_buys=v_sells then 'opening_or_ending_balance_unverified'
      else 'incomplete_cycle' end);
end $fn$;
revoke all on function public.get_live_realized_cycle_review(text) from public,anon;
grant execute on function public.get_live_realized_cycle_review(text) to authenticated;


create or replace function public.get_live_reconciliation_report()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  v_account uuid;v_response jsonb;v_coverage boolean;
  v_date date;
  v_snap record;
  v_items jsonb;
  v_total int;v_matched int;v_missing int;v_pending int;v_mismatch int;
  v_duplicates int;v_missing_fx int;v_unknown int;v_identity int;
  v_ledger_only int;v_ledger_only_items jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select a.id into v_account from public.accounts a
    where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
    order by a.created_at limit 1;
  select snapshot_date,snapshot_at,cash,total_assets,securities_value into v_snap
    from public.daily_account_snapshots where account_id=v_account
    order by snapshot_date desc limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','실제 계좌 잔고 기록 없음'); end if;
  v_date:=v_snap.snapshot_date;
  v_response:=public.read_batch_at_273(v_account::text,v_snap.snapshot_at);
  v_coverage:=coalesce((v_response->>'complete')::boolean,false)
    and (v_response->>'observed_at')::timestamptz=v_snap.snapshot_at;
  -- Compare both directions; a response cannot omit a live holding or silently
  -- include a position absent from the snapshot used by the report.
  if v_coverage then
    v_coverage:=not exists(select 1 from public.holdings h join public.securities s on s.id=h.security_id
      where h.account_id=v_account and (h.quantity is null or h.quantity<0
        or h.as_of is distinct from v_snap.snapshot_at
        or h.currency is distinct from s.currency
        or public.batch_effective_273(v_account::text,s.symbol,s.currency,v_snap.snapshot_at) is distinct from h.quantity))
      and not exists(select 1 from jsonb_array_elements(v_response->'rows') r
        where public.batch_effective_273(v_account::text,r->>'symbol',r->>'currency',v_snap.snapshot_at) is null
          or ((r->>'effective_quantity')::numeric>0 and
            (select sum(h.quantity) from public.holdings h join public.securities s on s.id=h.security_id
             where h.account_id=v_account and s.symbol=r->>'symbol' and s.currency=r->>'currency')
             is distinct from (r->>'effective_quantity')::numeric));
  end if;
  if v_coverage is not true then return jsonb_build_object('ok',false,
    'reason','QUANTITY_COVERAGE_UNVERIFIED','quantity_coverage_complete',false,
    'balance_at',v_snap.snapshot_at,'items','[]'::jsonb);end if;

  with raw_codes as materialized (
    select s.id,s.symbol,s.currency,
      case when s.symbol ~ '^A[0-9][0-9A-Z]{5}$' and s.currency='KRW'
        then substr(s.symbol,2) else s.symbol end normalized,
      coalesce(s.isin,(select nullif(trim(t.provider_payload->>'stnd_is_cd'),'')
        from public.transactions t where t.security_id=s.id
          and trim(t.provider_payload->>'stnd_is_cd') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
        order by t.trade_at desc limit 1)) isin
      from public.securities s
  ), identity as materialized (
    select r.id,coalesce(r.isin,
      (select x.isin from raw_codes x where x.normalized=r.normalized
        and x.currency=r.currency and x.isin is not null
        order by case when x.id=r.id then 0 else 1 end,x.id limit 1),
      r.currency||':'||r.normalized) asset_key from raw_codes r
  ), broker as (
    select h.security_id,i.asset_key,s.symbol,s.name,h.quantity actual_qty
    from public.holdings h join public.securities s on s.id=h.security_id
      join identity i on i.id=s.id
    where h.account_id=v_account and h.quantity>0
  ), activity as (
    select i.asset_key,t.trade_at,t.external_id,t.type,t.quantity,
      t.provider_payload->>'smry_nm' description,
      (t.trade_at at time zone 'Asia/Seoul')::date d,
      case when t.position_delta is not null then t.position_delta
        when t.type in ('buy','transfer_in','split_in','corporate_in') then t.quantity
        when t.type in ('sell','transfer_out','split_out','corporate_out') then -t.quantity
        else 0 end change
    from public.transactions t join identity i on i.id=t.security_id
    where t.account_id=v_account and t.quantity>0 and t.type in
      ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out','TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT','STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT')
  ), ledger as (
    select asset_key,count(*) filter(where d<v_date) prior_trades,
      count(*) filter(where d=v_date) same_day_trades,
      coalesce(sum(change) filter(where d<v_date),0) prior_quantity,
      coalesce(sum(change) filter(where d<=v_date),0) through_quantity,
      min(d) first_trade_date,max(d) last_trade_date,
      jsonb_agg(jsonb_build_object('date',d,'type',type,'quantity',quantity,'external_id',external_id,'description',description)
        order by trade_at desc,external_id desc) filter(where d>=v_date-7 and d<=v_date) recent_events
    from activity group by asset_key
  ), changes as (
    select ds.security_id,ds.snapshot_date,ds.quantity,
      lag(ds.quantity) over(partition by ds.security_id order by ds.snapshot_date) previous_qty
      from public.daily_security_snapshots ds where ds.account_id=v_account
  ), observations as (
    -- KB activity day can be settlement day, while holdings are intraday.
    -- The first missing-trade day cannot be inferred from these four snapshots.
    -- Report the last *observed balance change* as evidence, never mislabel it.
    select b.asset_key,max(c.snapshot_date) filter(where c.previous_qty is not null
      and abs(c.quantity-c.previous_qty)>0.000001) last_balance_change_date
    from broker b left join changes c on c.security_id=b.security_id
    group by b.asset_key
  ), diag as (
    select b.*,coalesce(l.prior_quantity,0) prior_quantity,
      coalesce(l.through_quantity,0) through_quantity,
      coalesce(l.prior_trades,0) prior_trades,coalesce(l.same_day_trades,0) same_day_trades,
      l.first_trade_date,l.last_trade_date,l.recent_events,o.last_balance_change_date,
      case when abs(b.actual_qty-coalesce(l.prior_quantity,0))<=0.000001
             or abs(b.actual_qty-coalesce(l.through_quantity,0))<=0.000001
        then 'quantity_matched'
        when coalesce(l.prior_trades,0)=0 and coalesce(l.same_day_trades,0)=0
          then 'ledger_missing'
        when coalesce(l.same_day_trades,0)>0 then 'same_day_pending'
        else 'quantity_unmatched' end state
    from broker b left join ledger l using(asset_key)
      left join observations o using(asset_key)
  ) select count(*),count(*) filter(where state='quantity_matched'),
    count(*) filter(where state='ledger_missing'),
    count(*) filter(where state='same_day_pending'),
    count(*) filter(where state='quantity_unmatched'),
    coalesce(jsonb_agg(jsonb_build_object('symbol',symbol,'name',name,
      'security_id',security_id,'asset_key',asset_key,'actual_qty',actual_qty,
      'ledger_qty_before_balance_day',prior_quantity,'ledger_qty_through_balance_day',through_quantity,
      'difference_qty',actual_qty-through_quantity,'first_unmatched_date',null,
      'last_observed_balance_change_date',last_balance_change_date,
      'first_trade',first_trade_date,'last_trade',last_trade_date,
      'prior_trade_count',prior_trades,'same_day_trade_count',same_day_trades,
      'recent_events',coalesce(recent_events,'[]'::jsonb),'state',state)
      order by case state when 'quantity_unmatched' then 0 when 'ledger_missing' then 1
        when 'same_day_pending' then 2 else 3 end,symbol),'[]'::jsonb)
    into v_total,v_matched,v_missing,v_pending,v_mismatch,v_items from diag;
  with raw_codes as materialized (
    select s.id,s.symbol,s.currency,
      case when s.symbol ~ '^A[0-9][0-9A-Z]{5}$' and s.currency='KRW'
        then substr(s.symbol,2) else s.symbol end normalized,
      coalesce(s.isin,(select nullif(trim(t.provider_payload->>'stnd_is_cd'),'')
        from public.transactions t where t.security_id=s.id
          and trim(t.provider_payload->>'stnd_is_cd') ~ '^[A-Z]{2}[A-Z0-9]{10}$'
        order by t.trade_at desc limit 1)) isin
    from public.securities s
  ), identity as materialized (
    select r.id,coalesce(r.isin,
      (select x.isin from raw_codes x where x.normalized=r.normalized
        and x.currency=r.currency and x.isin is not null
        order by case when x.id=r.id then 0 else 1 end,x.id limit 1),
      r.currency||':'||r.normalized) asset_key from raw_codes r
  ), broker as (
    select distinct i.asset_key from public.holdings h
      join identity i on i.id=h.security_id
    where h.account_id=v_account and h.quantity>0
  ), activity as (
    select i.asset_key,t.security_id,s.symbol,s.name,t.trade_at,t.external_id,
      t.type,t.quantity,t.provider_payload->>'smry_nm' description,
      (t.trade_at at time zone 'Asia/Seoul')::date d,
      case when t.position_delta is not null then t.position_delta
        when t.type in ('buy','transfer_in','split_in','corporate_in') then t.quantity
        else -t.quantity end change
    from public.transactions t join identity i on i.id=t.security_id
      join public.securities s on s.id=t.security_id
    where t.account_id=v_account and t.quantity>0 and t.type in
      ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out','TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT','STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT')
  ), ledger as (
    select asset_key,(array_agg(security_id order by trade_at desc))[1] security_id,
      (array_agg(symbol order by trade_at desc))[1] symbol,
      (array_agg(name order by trade_at desc))[1] name,
      count(*) filter(where d<v_date) prior_trades,
      count(*) filter(where d=v_date) same_day_trades,
      coalesce(sum(change) filter(where d<v_date),0) prior_quantity,
      coalesce(sum(change) filter(where d<=v_date),0) through_quantity,
      min(d) first_trade_date,max(d) last_trade_date,
      jsonb_agg(jsonb_build_object('date',d,'type',type,'quantity',quantity,
        'external_id',external_id,'description',description)
        order by trade_at desc,external_id desc)
        filter(where d between v_date-7 and v_date) recent_events
    from activity where d<=v_date group by asset_key
  ), orphan as (
    select l.* from ledger l left join broker b using(asset_key)
      where b.asset_key is null and abs(l.through_quantity)>.000001
  ) select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'symbol',symbol,'name',name,'security_id',security_id,'asset_key',asset_key,
      'actual_qty',0,'ledger_qty_before_balance_day',prior_quantity,
      'ledger_qty_through_balance_day',through_quantity,'difference_qty',-through_quantity,
      'first_unmatched_date',null,'first_trade',first_trade_date,'last_trade',last_trade_date,
      'prior_trade_count',prior_trades,'same_day_trade_count',same_day_trades,
      'recent_events',coalesce(recent_events,'[]'::jsonb),'state','ledger_only')
      order by symbol),'[]'::jsonb)
    into v_ledger_only,v_ledger_only_items from orphan;
  v_total:=v_total+v_ledger_only;
  v_items:=v_ledger_only_items||v_items;
  select count(*) into v_duplicates from (
    select external_id from public.transactions where account_id=v_account
      group by external_id having count(*)>1) d;
  select count(*) into v_missing_fx from public.transactions t
    where t.account_id=v_account and t.currency='USD' and
      (t.fx_rate is null or t.fx_rate not between 500 and 3000)
      and t.type in ('buy','sell');
  select count(*) into v_unknown from public.transactions t
    where t.account_id=v_account and t.type='sell' and t.security_id is null;
  select count(*) into v_identity from (
    with x as (select s.snapshot_date,s.total_assets,s.external_flow,
      lag(s.total_assets) over(order by s.snapshot_date) previous_assets
      from public.daily_account_snapshots s where s.account_id=v_account)
    select 1 from x join public.portfolio_performance p
      on p.account_id=v_account and p.performance_date=x.snapshot_date
    where x.previous_assets is not null and
      p.daily_pnl is distinct from x.total_assets-x.previous_assets-x.external_flow
  ) z;
  -- Alias/identity grouping must also agree with the selected response.
  if exists(select 1 from jsonb_array_elements(v_items) j
    left join public.securities s on s.id=(j->>'security_id')::uuid
    where public.batch_effective_273(v_account::text,j->>'symbol',s.currency,v_snap.snapshot_at)
      is distinct from (j->>'actual_qty')::numeric)
    or (select count(*)<>count(distinct j->>'asset_key') from jsonb_array_elements(v_items) j)
  then return jsonb_build_object('ok',false,'reason','QUANTITY_IDENTITY_UNVERIFIED',
    'quantity_coverage_complete',false,'balance_at',v_snap.snapshot_at,'items','[]'::jsonb);end if;
  return jsonb_build_object('ok',true,'quantity_coverage_complete',true,
    'quantity_response_id',v_response->'response_id',
    'data_version',md5(v_response::text||v_items::text),
    'checked_at',now(),'balance_date',v_date,
    'balance_at',v_snap.snapshot_at,'broker_cash_krw',v_snap.cash,
    'broker_total_assets_krw',v_snap.total_assets,
    'broker_securities_krw',v_snap.securities_value,
    'quantity_total',v_total,'quantity_matched',v_matched,
    'quantity_ledger_missing',v_missing,'quantity_same_day_pending',v_pending,
    'quantity_unmatched',v_mismatch,'duplicate_trade_ids',v_duplicates,
    'quantity_ledger_only',v_ledger_only,
    'missing_historical_fx_trades',v_missing_fx,'unmapped_sales',v_unknown,
    'performance_identity_errors',v_identity,'cash_reconstructable',false,
    'cash_reason','초기 현금잔고와 모든 결제시점이 검증되지 않아 이전 현금은 재구성 중입니다.',
    'items',v_items);
end $$;
revoke all on function public.get_live_reconciliation_report() from public,anon;
grant execute on function public.get_live_reconciliation_report() to authenticated;


create or replace function public.get_reconciliation_case_timeline(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare c public.reconciliation_cases;v_events jsonb;v_evidence jsonb;v_obs jsonb;v_balance jsonb;
begin
  select x.* into c from public.reconciliation_cases x
    join public.accounts a on a.id=x.account_id
    where x.id=p_case_id and a.user_id=(select auth.uid());
  if not found then raise exception 'CASE_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',coalesce(t.order_at,t.trade_at),
    'type',t.type,'normalized_type',coalesce(t.normalized_type,t.type),
    'raw_type',t.raw_type,'quantity',t.quantity,'position_delta',t.position_delta,
    'source',t.provider_revision,
    'order_at',t.order_at,'settlement_at',t.settlement_at)
    order by coalesce(t.order_at,t.trade_at),t.id),'[]'::jsonb) into v_events
    from public.transactions t join public.securities s on s.id=t.security_id
    where t.account_id=c.account_id and
      (s.id=c.security_id or (c.asset_key like '__%' and s.isin=c.asset_key)
       or (s.symbol=c.symbol and s.currency=c.currency))
      and t.type in ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out',
        'TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT',
        'STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT');
  select coalesce(jsonb_agg(jsonb_build_object('source',source,'order_date',order_date,
    'settlement_date',settlement_date,'type',event_type,'quantity',quantity,'price',price,
    'currency',currency) order by order_date),'[]'::jsonb) into v_evidence
    from public.kb_position_evidence e where e.account_id=c.account_id and e.asset_key=c.asset_key
      and e.active
      and not exists(select 1 from public.transactions t
        where t.account_id=e.account_id and t.provider_payload->>'stnd_is_cd'=e.asset_key
          and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
          and t.type=e.event_type and t.quantity=e.quantity);
  select coalesce(jsonb_agg(jsonb_build_object('fetched_at',p.fetched_at,'quantity',p.quantity)
    order by p.fetched_at),'[]'::jsonb) into v_obs from public.position_observations p
    join public.securities s on s.id=p.security_id
    where p.account_id=c.account_id and
      (s.id=c.security_id or s.isin=c.asset_key or (s.symbol=c.symbol and s.currency=c.currency));
  select public.batch_balance_273(c.account_id::text,c.symbol,c.currency,
    (select max(d.snapshot_at) from public.daily_account_snapshots d where d.account_id=c.account_id)) into v_balance;
  return jsonb_build_object('case',to_jsonb(c)-'user_note','events',v_events,
    'other_official_evidence',v_evidence,'observations',v_obs,'balance_evidence',v_balance);
end $function$;


create or replace function public.refresh_reconciliation_cases_for_service(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_account uuid;v_report jsonb;v_item jsonb;v_asset text;v_security uuid;
  v_delta numeric;v_evidence_qty numeric;v_evidence_count int;v_realized int;
  v_status text;v_causes jsonb;v_sources jsonb;v_confidence jsonb;
  v_last_kb date;v_first_mismatch date;v_last_matched date;v_balance_date date;
  v_market text;v_currency text;v_prev public.reconciliation_cases;v_balance record;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  if v_account is null then raise exception 'NO_LIVE_ACCOUNT'; end if;
  -- The existing report is owner-scoped; impersonation is local to this call,
  -- after checking the privileged service identity.
  perform set_config('request.jwt.claim.sub',p_user_id::text,true);
  v_report:=public.get_live_reconciliation_report();
  if coalesce((v_report->>'ok')::boolean,false)=false then return v_report; end if;
  -- Validate the entire report BEFORE any case mutation. Partial success is not coverage.
  if v_report->'quantity_coverage_complete' is distinct from 'true'::jsonb
    or jsonb_typeof(v_report->'items') is distinct from 'array'
    or nullif(v_report->>'balance_at','') is null then
    return jsonb_build_object('ok',false,'reason','QUANTITY_COVERAGE_UNVERIFIED');
  end if;
  for v_item in select value from jsonb_array_elements(v_report->'items') loop
    if jsonb_typeof(v_item->'actual_qty') is distinct from 'number'
      or jsonb_typeof(v_item->'ledger_qty_through_balance_day') is distinct from 'number'
      or jsonb_typeof(v_item->'difference_qty') is distinct from 'number' then
      return jsonb_build_object('ok',false,'reason','QUANTITY_FIELDS_INCOMPLETE');
    end if;
    select currency into v_currency from public.securities where id=nullif(v_item->>'security_id','')::uuid;
    v_delta:=public.batch_effective_273(v_account::text,v_item->>'symbol',v_currency,(v_report->>'balance_at')::timestamptz);
    if v_delta is null or (v_item->>'actual_qty')::numeric<0
      or abs(v_delta-(v_item->>'actual_qty')::numeric)>.000001
      or abs((v_item->>'actual_qty')::numeric-(v_item->>'ledger_qty_through_balance_day')::numeric-(v_item->>'difference_qty')::numeric)>.000001 then
      return jsonb_build_object('ok',false,'reason','QUANTITY_EVIDENCE_UNVERIFIED');
    end if;
  end loop;
  v_balance_date:=(v_report->>'balance_date')::date;
  for v_item in select value from jsonb_array_elements(v_report->'items') loop
    v_asset:=v_item->>'asset_key'; v_security:=nullif(v_item->>'security_id','')::uuid;
    select market,currency into v_market,v_currency from public.securities where id=v_security;
    select * into v_prev from public.reconciliation_cases
      where account_id=v_account and asset_key=v_asset;
    if v_item->>'state'='quantity_matched' and v_prev.id is null then continue; end if;
    v_delta:=coalesce((v_item->>'difference_qty')::numeric,0);
    select coalesce(sum(case when event_type='buy' then quantity
         when event_type='sell' then -quantity else 0 end),0),count(*)
      into v_evidence_qty,v_evidence_count from public.kb_position_evidence e
      where e.account_id=v_account and e.asset_key=v_asset and e.source='SPQM2205' and e.active
        and e.order_date <= v_balance_date and e.order_date >= v_balance_date-10
        and not exists(select 1 from public.transactions t
          where t.account_id=e.account_id and t.provider_payload->>'stnd_is_cd'=e.asset_key
            and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
            and t.type=e.event_type and t.quantity=e.quantity);
    select count(*) into v_realized from public.realized_pnl_events p
      join public.securities s on s.id=p.security_id
      where p.account_id=v_account and
        (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency));
    select b.symbol,b.settled settled_quantity,b.effective effective_quantity,
      b.pending_buy pending_buy_quantity,b.pending_sell pending_sell_quantity into v_balance
      from jsonb_to_record(public.batch_balance_273(v_account::text,v_item->>'symbol',v_currency,
        (v_report->>'balance_at')::timestamptz))
      as b(symbol text,settled numeric,effective numeric,pending_buy numeric,pending_sell numeric);
    select max((t.trade_at at time zone 'Asia/Seoul')::date) into v_last_kb
      from public.transactions t join public.securities s on s.id=t.security_id
      where t.account_id=v_account and t.source='api' and
        (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency));
    -- Either intraday trade ordering may explain a same-day snapshot. Only
    -- identify an interval when an actual earlier matched observation exists.
    with observations as (
      select distinct on(o.balance_date) o.id,o.balance_date
        from public.account_observations o where o.account_id=v_account
          and o.balance_date<=v_balance_date
        order by o.balance_date,o.fetched_at desc
    ), comparisons as (
      select o.balance_date,
        public.batch_effective_273(v_account::text,v_item->>'symbol',v_currency,
          (select fetched_at from public.account_observations where id=o.id)) actual,
        coalesce((select sum(case when t.position_delta is not null then t.position_delta
          when t.type in('buy','transfer_in','split_in','corporate_in') then t.quantity
          else -t.quantity end) from public.transactions t join public.securities s on s.id=t.security_id
          where t.account_id=v_account and t.quantity>0 and t.type in
            ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out',
            'TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT',
            'STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT')
          and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<o.balance_date and
            (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency))),0) before_qty,
        coalesce((select sum(case when t.position_delta is not null then t.position_delta
          when t.type in('buy','transfer_in','split_in','corporate_in') then t.quantity
          else -t.quantity end) from public.transactions t join public.securities s on s.id=t.security_id
          where t.account_id=v_account and t.quantity>0 and t.type in
            ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out',
            'TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT',
            'STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT')
          and (coalesce(t.order_at,t.trade_at) at time zone 'Asia/Seoul')::date<=o.balance_date and
            (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency))),0) through_qty
      from observations o
    ), marks as (
      select balance_date,(abs(actual-before_qty)<=.000001
        or abs(actual-through_qty)<=.000001) matched from comparisons
    ), last_match as (select max(balance_date) d from marks where matched)
    select min(m.balance_date) filter(where not m.matched and
        (l.d is null or m.balance_date>l.d)),l.d
      into v_first_mismatch,v_last_matched
      from marks m cross join last_match l group by l.d;
    if abs(v_delta)<.000001 then
      v_status:='resolved';v_causes:='["KB 잔고와 확정 원장 수량 일치"]'::jsonb;
    elsif v_evidence_count>0 and abs(v_evidence_qty-v_delta)<.000001
      and v_balance.symbol is not null
      and abs(v_balance.settled_quantity-coalesce((v_item->>'ledger_qty_through_balance_day')::numeric,0))<.000001
      and abs(v_balance.effective_quantity-coalesce((v_item->>'actual_qty')::numeric,0))<.000001
      and abs(v_delta-(v_balance.pending_buy_quantity-v_balance.pending_sell_quantity))<.000001 then
      v_status:='settlement_pending';
      v_causes:=jsonb_build_array('KB 미결제 매수·매도 수량이 원장 차이와 정확히 일치',
        'KB 해외 체결·결제 기록의 예정 결제일 이후 거래원장 자동 재확인');
    elsif v_evidence_count>0 and abs(v_evidence_qty-v_delta)<.000001 then
      v_status:='likely_missing_trade';
      v_causes:=jsonb_build_array('KB 해외 체결·결제 조회의 수량 변화가 현재 차이와 일치',
        '거래원장에 같은 사건이 있는지 결제일 이후 재확인 필요');
    elsif coalesce((v_item->>'actual_qty')::numeric,0)=0 and v_realized>0 then
      v_status:='position_closed_but_trade_details_missing';
      v_causes:=jsonb_build_array('KB 현재 잔고 0주로 종료 상태 확인',
        'KB 과거 실현손익 확인, 남은 수량을 해소하는 종료 거래의 날짜·가격·종류 미확인');
    elsif coalesce((v_item->>'actual_qty')::numeric,0)=0 then
      v_status:='manual_source_required';
      v_causes:=jsonb_build_array('KB 잔고 0주, 원장 종료 또는 출고 이벤트 확인 필요');
    else
      v_status:='source_data_insufficient';
      v_causes:=jsonb_build_array('현재 잔고와 거래원장 수량이 다름',
        '해외 체결, 이전 거래, 입출고 또는 잔고 반영시점 추가 확인 필요');
    end if;
    if coalesce(v_prev.user_confirmed_closed,false) and v_status<>'resolved' then
      v_status:='user_confirmed_position_closed';
    end if;
    v_sources:=jsonb_build_array('KB 현재잔고','SWQA2301 거래원장');
    if v_balance.symbol is not null then v_sources:=v_sources||'"SSQM2952 미결제수량"'::jsonb; end if;
    if v_evidence_count>0 then v_sources:=v_sources||'"SPQM2205 해외 체결·결제"'::jsonb; end if;
    if v_realized>0 then v_sources:=v_sources||'"SSQM2442 국내 실현손익"'::jsonb; end if;
    v_confidence:=jsonb_build_object(
      'quantity',case when v_status='resolved' then 'verified' when v_status='settlement_pending' then 'official_pending_explained' when v_status='likely_missing_trade' then 'cross_source_pending' else 'unresolved' end,
      'trade_completeness',case when v_status='settlement_pending' then 'awaiting_ledger_settlement' when v_status='resolved' then 'verified_for_quantity' else 'incomplete' end,
      'price_completeness',case when v_status='settlement_pending' then 'official_execution_price_unsettled' when v_status='resolved' then 'source_rows_available' else 'unverified' end,
      'fx_completeness',case when v_currency='KRW' then 'not_applicable' else 'partly_estimated' end,
      'cash_flow_completeness','unverified');
    insert into public.reconciliation_cases(account_id,asset_key,security_id,symbol,name,market,currency,
      kb_quantity,ledger_quantity,difference_quantity,first_ledger_date,last_ledger_date,
      last_kb_trade_date,first_mismatch_from,first_mismatch_to,source_summary,possible_causes,
      confidence,status,checked_at,resolved_at)
    values(v_account,v_asset,v_security,v_item->>'symbol',v_item->>'name',v_market,v_currency,
      coalesce((v_item->>'actual_qty')::numeric,0),
      coalesce((v_item->>'ledger_qty_through_balance_day')::numeric,0),v_delta,
      nullif(v_item->>'first_trade','')::date,nullif(v_item->>'last_trade','')::date,
      v_last_kb,v_last_matched,v_first_mismatch,v_sources,v_causes,v_confidence,
      v_status,now(),case when v_status='resolved' then now() else null end)
    on conflict(account_id,asset_key) do update set
      security_id=excluded.security_id,symbol=excluded.symbol,name=excluded.name,
      market=excluded.market,currency=excluded.currency,kb_quantity=excluded.kb_quantity,
      ledger_quantity=excluded.ledger_quantity,difference_quantity=excluded.difference_quantity,
      first_ledger_date=excluded.first_ledger_date,last_ledger_date=excluded.last_ledger_date,
      last_kb_trade_date=excluded.last_kb_trade_date,first_mismatch_from=excluded.first_mismatch_from,
      first_mismatch_to=excluded.first_mismatch_to,source_summary=excluded.source_summary,
      possible_causes=excluded.possible_causes,confidence=excluded.confidence,status=excluded.status,
      checked_at=now(),resolved_at=excluded.resolved_at;
  end loop;
  -- Once a subsequently confirmed closing trade reduces a formerly orphaned
  -- position to zero, the report intentionally omits it. Close that old case
  -- only after independently checking the now-complete signed source ledger.
  update public.reconciliation_cases c set status='resolved',difference_quantity=0,
    ledger_quantity=0,checked_at=now(),resolved_at=now(),
    possible_causes='["이후 확인된 KB 거래로 원장 수량이 0주가 됨"]'::jsonb,
    confidence=jsonb_set(c.confidence,'{quantity}','"verified"'::jsonb)
    where c.account_id=v_account and c.status<>'resolved' and c.kb_quantity=0
      and public.batch_effective_273(v_account::text,c.symbol,c.currency,(v_report->>'balance_at')::timestamptz)=0
      and not exists(select 1 from jsonb_array_elements(v_report->'items') j
        where j->>'asset_key'=c.asset_key)
      and coalesce((select sum(case when t.position_delta is not null then t.position_delta
          when t.type in('buy','transfer_in','split_in','corporate_in')
          then t.quantity else -t.quantity end)
        from public.transactions t join public.securities s on s.id=t.security_id
        where t.account_id=v_account and t.quantity>0 and t.type in
          ('buy','sell','transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out',
          'TRANSFER_IN','TRANSFER_OUT','ACCOUNT_TRANSFER','BROKER_TRANSFER_IN','BROKER_TRANSFER_OUT',
          'STOCK_SPLIT','REVERSE_SPLIT','MERGER','SPINOFF','SYMBOL_CHANGE','STOCK_DIVIDEND','RIGHTS_EVENT','OTHER_POSITION_ADJUSTMENT')
          and (s.id=c.security_id or s.isin=c.asset_key or (s.symbol=c.symbol and s.currency=c.currency))
          and (t.trade_at at time zone 'Asia/Seoul')::date<=v_balance_date),0)=0;
  return jsonb_build_object('total',v_report->'quantity_total','matched',v_report->'quantity_matched',
    'cases',(select count(*) from public.reconciliation_cases where account_id=v_account and status<>'resolved'));
end $function$;


-- Local rollout candidate. Preserve existing column order/types for REST clients.
-- An unknown response is represented by null quantities, never legacy fallback.
create or replace view public.live_position_settlement_basis
with (security_invoker=true) as
with positions as (
 select h.account_id,s.symbol,s.currency,h.currency holding_currency,h.quantity,h.as_of,
   count(*) over(partition by h.account_id,s.symbol) identity_count,
   (select d.snapshot_at from public.daily_account_snapshots d where d.account_id=h.account_id
    order by d.snapshot_at desc limit 1) snapshot_at
 from public.holdings h join public.securities s on s.id=h.security_id
 join public.accounts a on a.id=h.account_id
 where a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
), evidence as (
 select p.*,public.batch_balance_273(account_id::text,symbol,currency,as_of) b from positions p
), classified as (
 select e.*,case
 when identity_count<>1 or holding_currency is distinct from currency then 'identity_unverified'
 when as_of is distinct from snapshot_at then 'snapshot_mismatch'
 when b->>'status' is distinct from 'complete_row' then coalesce(b->>'status','missing')
 when quantity is distinct from (b->>'effective')::numeric then 'holding_mismatch'
 else 'complete_row' end status from evidence e
)
select account_id,symbol,
 (b->>'observed_at')::timestamptz observed_at,
 case when status='complete_row' then (b->>'settled')::numeric end settled_quantity,
 case when status='complete_row' then (b->>'pending_buy')::numeric end pending_buy_quantity,
 case when status='complete_row' then (b->>'pending_sell')::numeric end pending_sell_quantity,
 case when status='complete_row' then (b->>'effective')::numeric end effective_quantity,
 case when status='complete_row' then (b->>'settled')::numeric+(b->>'pending_buy')::numeric-(b->>'pending_sell')::numeric end reconstructed_effective_quantity,
 case when status='complete_row' then true end quantity_identity_ok,
 case when status='complete_row' then 'SSQM2952'::text end source,
 currency,status evidence_status,b->>'response_id' response_id
from classified;
revoke all on public.live_position_settlement_basis from public,anon;
grant select on public.live_position_settlement_basis to authenticated;


alter function public.get_live_period_stock_pnl(text) security invoker;
revoke all on function public.get_live_period_stock_pnl(text) from public,anon;
grant execute on function public.get_live_period_stock_pnl(text) to authenticated,service_role;

alter function public.get_live_realized_cycle_review(text) security invoker;
revoke all on function public.get_live_realized_cycle_review(text) from public,anon;
grant execute on function public.get_live_realized_cycle_review(text) to authenticated,service_role;

alter function public.get_live_reconciliation_report() security invoker;
revoke all on function public.get_live_reconciliation_report() from public,anon;
grant execute on function public.get_live_reconciliation_report() to authenticated,service_role;

alter function public.get_live_settlement_bridge(date) security invoker;
revoke all on function public.get_live_settlement_bridge(date) from public,anon;
grant execute on function public.get_live_settlement_bridge(date) to authenticated,service_role;

alter function public.get_reconciliation_case_timeline(uuid) security invoker;
revoke all on function public.get_reconciliation_case_timeline(uuid) from public,anon;
grant execute on function public.get_reconciliation_case_timeline(uuid) to authenticated,service_role;

revoke all on function public.refresh_reconciliation_cases_for_service(uuid) from public,anon,authenticated;
grant execute on function public.refresh_reconciliation_cases_for_service(uuid) to service_role;

grant execute on function public.read_batch_at_273(text,timestamptz) to service_role;

commit;