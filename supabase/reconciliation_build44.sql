-- Build 44: evidence is separate from the confirmed transaction ledger.
-- Source rows never become invented fills or P&L adjustments.
alter table public.transactions
  add column if not exists order_at timestamptz,
  add column if not exists account_reflected_at timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists raw_type text,
  add column if not exists normalized_type text;
update public.transactions set raw_type=coalesce(raw_type,provider_payload->>'smry_nm'),
  normalized_type=coalesce(normalized_type,type), fetched_at=coalesce(fetched_at,created_at)
where source='api' and (raw_type is null or normalized_type is null or fetched_at is null);
comment on column public.transactions.normalized_type is
  'Parser classification; future confirmed transfer, broker transfer, split, merger, spin-off, symbol change, stock dividend, rights and other source-backed events retain their distinct names here.';

create table if not exists public.kb_position_evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null,
  source_key text not null,
  asset_key text not null,
  symbol text not null,
  raw_type text,
  event_type text,
  order_date date,
  trade_date date,
  settlement_date date,
  quantity numeric,
  price numeric,
  gross_amount numeric,
  currency text,
  evidence jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique(account_id,source,source_key)
);
create index if not exists kb_position_evidence_asset on public.kb_position_evidence(account_id,asset_key,order_date);

create table if not exists public.reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_key text not null,
  security_id uuid references public.securities(id),
  symbol text not null,
  name text not null,
  market text,
  currency text,
  kb_quantity numeric not null default 0,
  ledger_quantity numeric not null default 0,
  difference_quantity numeric not null default 0,
  first_ledger_date date,
  last_ledger_date date,
  last_kb_trade_date date,
  first_mismatch_from date,
  first_mismatch_to date,
  source_summary jsonb not null default '[]'::jsonb,
  possible_causes jsonb not null default '[]'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  status text not null default 'source_data_insufficient',
  user_confirmed_closed boolean not null default false,
  user_note text,
  checked_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(account_id,asset_key),
  constraint reconciliation_case_status_check check(status in
    ('resolved','likely_missing_trade','likely_transfer','likely_corporate_action',
    'source_data_insufficient','manual_source_required',
    'position_closed_but_trade_details_missing','user_confirmed_position_closed'))
);
create index if not exists reconciliation_cases_status on public.reconciliation_cases(account_id,status);

create table if not exists public.account_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  fetched_at timestamptz not null,
  balance_date date not null,
  cash_krw numeric,
  foreign_cash jsonb not null default '{}'::jsonb,
  total_assets_krw numeric,
  source_sync_id uuid,
  source text not null default 'kb_current_snapshot',
  unique(account_id,fetched_at)
);
create table if not exists public.position_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  account_observation_id uuid not null references public.account_observations(id) on delete cascade,
  security_id uuid not null references public.securities(id),
  fetched_at timestamptz not null,
  quantity numeric not null,
  avg_cost numeric,
  market_price numeric,
  market_value numeric,
  currency text,
  unique(account_observation_id,security_id)
);
create index if not exists position_observations_lookup on public.position_observations(account_id,security_id,fetched_at);

alter table public.kb_position_evidence enable row level security;
alter table public.reconciliation_cases enable row level security;
alter table public.account_observations enable row level security;
alter table public.position_observations enable row level security;
create policy kb_position_evidence_read on public.kb_position_evidence for select to authenticated
  using (exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy reconciliation_cases_read on public.reconciliation_cases for select to authenticated
  using (exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy account_observations_read on public.account_observations for select to authenticated
  using (exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy position_observations_read on public.position_observations for select to authenticated
  using (exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
grant select on public.kb_position_evidence,public.reconciliation_cases,
  public.account_observations,public.position_observations to authenticated;

create or replace function public.capture_kb_account_observation() returns trigger
language plpgsql security definer set search_path='' as $function$
declare v_id uuid;
begin
  if not exists(select 1 from public.accounts where id=new.account_id and mode='live' and provider='kb_securities') then return new; end if;
  insert into public.account_observations(account_id,fetched_at,balance_date,cash_krw,total_assets_krw,source_sync_id)
  values(new.account_id,new.snapshot_at,new.snapshot_date,new.cash,new.total_assets,new.source_sync_id)
  on conflict(account_id,fetched_at) do update set cash_krw=excluded.cash_krw,
    total_assets_krw=excluded.total_assets_krw,source_sync_id=excluded.source_sync_id
  returning id into v_id;
  insert into public.position_observations(account_id,account_observation_id,security_id,fetched_at,
    quantity,avg_cost,market_price,market_value,currency)
  select h.account_id,v_id,h.security_id,new.snapshot_at,h.quantity,h.avg_cost,h.market_price,h.market_value,h.currency
    from public.holdings h where h.account_id=new.account_id and h.quantity>0
  on conflict(account_observation_id,security_id) do update set
    quantity=excluded.quantity,avg_cost=excluded.avg_cost,market_price=excluded.market_price,
    market_value=excluded.market_value,currency=excluded.currency;
  return new;
end $function$;
drop trigger if exists capture_kb_account_observation on public.daily_account_snapshots;
create trigger capture_kb_account_observation after insert or update on public.daily_account_snapshots
  for each row execute function public.capture_kb_account_observation();
-- Existing daily rows have one observation per day, timestamped by the stored KB fetch.
insert into public.account_observations(account_id,fetched_at,balance_date,cash_krw,total_assets_krw,source_sync_id,source)
select d.account_id,d.snapshot_at,d.snapshot_date,d.cash,d.total_assets,d.source_sync_id,'daily_snapshot_legacy'
from public.daily_account_snapshots d join public.accounts a on a.id=d.account_id
where a.mode='live' and a.provider='kb_securities' on conflict do nothing;
insert into public.position_observations(account_id,account_observation_id,security_id,fetched_at,
  quantity,avg_cost,market_price,market_value,currency)
select d.account_id,o.id,d.security_id,o.fetched_at,d.quantity,d.avg_cost,d.market_price,d.market_value,d.currency
from public.daily_security_snapshots d join public.account_observations o
  on o.account_id=d.account_id and o.balance_date=d.snapshot_date and o.source='daily_snapshot_legacy'
on conflict do nothing;

-- Only a signed-in owner may acknowledge a position closure. No transaction is written.
create or replace function public.confirm_position_closed(p_case_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_case public.reconciliation_cases;
begin
  update public.reconciliation_cases c set user_confirmed_closed=true,
    user_note=left(coalesce(p_note,''),500),
    status=case when c.status='resolved' then c.status else 'user_confirmed_position_closed' end,
    checked_at=now()
  where c.id=p_case_id and c.kb_quantity=0
    and exists(select 1 from public.accounts a where a.id=c.account_id and a.user_id=(select auth.uid()))
  returning c.* into v_case;
  if not found then raise exception 'CASE_NOT_FOUND_OR_NOT_CLOSED'; end if;
  return jsonb_build_object('id',v_case.id,'status',v_case.status);
end $function$;
revoke all on function public.confirm_position_closed(uuid,text) from public,anon;
grant execute on function public.confirm_position_closed(uuid,text) to authenticated;

-- Bounded, authenticated case timeline: raw payload and account references are excluded.
create or replace function public.get_reconciliation_case_timeline(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare c public.reconciliation_cases;v_events jsonb;v_evidence jsonb;v_obs jsonb;
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
      and not exists(select 1 from public.transactions t
        where t.account_id=e.account_id and t.provider_payload->>'stnd_is_cd'=e.asset_key
          and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
          and t.type=e.event_type and t.quantity=e.quantity);
  select coalesce(jsonb_agg(jsonb_build_object('fetched_at',p.fetched_at,'quantity',p.quantity)
    order by p.fetched_at),'[]'::jsonb) into v_obs from public.position_observations p
    join public.securities s on s.id=p.security_id
    where p.account_id=c.account_id and
      (s.id=c.security_id or s.isin=c.asset_key or (s.symbol=c.symbol and s.currency=c.currency));
  return jsonb_build_object('case',to_jsonb(c)-'user_note','events',v_events,
    'other_official_evidence',v_evidence,'observations',v_obs);
end $function$;
revoke all on function public.get_reconciliation_case_timeline(uuid) from public,anon;
grant execute on function public.get_reconciliation_case_timeline(uuid) to authenticated;

-- A KB settlement row is a dated, source-backed observation. It is deliberately
-- not inserted into transactions until cross-source identity is unambiguous.
create or replace function public.save_kb_position_evidence_for_service(p_user_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_account uuid;v_row jsonb;v_count int:=0;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select id into v_account from public.accounts where user_id=p_user_id and mode='live'
    and provider='kb_securities' and is_active order by created_at limit 1;
  if v_account is null then raise exception 'NO_LIVE_ACCOUNT'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>300 then raise exception 'INVALID_EVIDENCE_BATCH'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if (v_row->>'source') not in ('SPQM2205','SSQM2442','SWQA2301') then continue; end if;
    if nullif(v_row->>'source_key','') is null or nullif(v_row->>'asset_key','') is null then continue; end if;
    insert into public.kb_position_evidence(account_id,source,source_key,asset_key,symbol,
      raw_type,event_type,order_date,trade_date,settlement_date,quantity,price,gross_amount,currency,evidence)
    values(v_account,v_row->>'source',v_row->>'source_key',v_row->>'asset_key',v_row->>'symbol',
      v_row->>'raw_type',v_row->>'event_type',nullif(v_row->>'order_date','')::date,
      nullif(v_row->>'trade_date','')::date,nullif(v_row->>'settlement_date','')::date,
      nullif(v_row->>'quantity','')::numeric,nullif(v_row->>'price','')::numeric,
      nullif(v_row->>'gross_amount','')::numeric,v_row->>'currency',
      coalesce(v_row->'evidence','{}'::jsonb))
    on conflict(account_id,source,source_key) do update set
      settlement_date=excluded.settlement_date,quantity=excluded.quantity,
      price=excluded.price,gross_amount=excluded.gross_amount,
      evidence=excluded.evidence,fetched_at=now();
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;
revoke all on function public.save_kb_position_evidence_for_service(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_position_evidence_for_service(uuid,jsonb) to service_role;

create or replace function public.refresh_reconciliation_cases_for_service(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_account uuid;v_report jsonb;v_item jsonb;v_asset text;v_security uuid;
  v_delta numeric;v_evidence_qty numeric;v_evidence_count int;v_realized int;
  v_status text;v_causes jsonb;v_sources jsonb;v_confidence jsonb;
  v_last_kb date;v_first_mismatch date;v_last_matched date;v_balance_date date;
  v_market text;v_currency text;v_prev public.reconciliation_cases;
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
      where e.account_id=v_account and e.asset_key=v_asset and e.source='SPQM2205'
        and e.order_date <= v_balance_date and e.order_date >= v_balance_date-10
        and not exists(select 1 from public.transactions t
          where t.account_id=e.account_id and t.provider_payload->>'stnd_is_cd'=e.asset_key
            and (t.trade_at at time zone 'Asia/Seoul')::date=e.settlement_date
            and t.type=e.event_type and t.quantity=e.quantity);
    select count(*) into v_realized from public.realized_pnl_events p
      join public.securities s on s.id=p.security_id
      where p.account_id=v_account and
        (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency));
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
        coalesce((select sum(p.quantity) from public.position_observations p
          join public.securities s on s.id=p.security_id
          where p.account_observation_id=o.id and
            (s.id=v_security or s.isin=v_asset or (s.symbol=v_item->>'symbol' and s.currency=v_currency))),0) actual,
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
    if v_evidence_count>0 then v_sources:=v_sources||'"SPQM2205 해외 체결·결제"'::jsonb; end if;
    if v_realized>0 then v_sources:=v_sources||'"SSQM2442 국내 실현손익"'::jsonb; end if;
    v_confidence:=jsonb_build_object(
      'quantity',case when v_status='resolved' then 'verified' when v_status='likely_missing_trade' then 'cross_source_pending' else 'unresolved' end,
      'trade_completeness',case when v_status='resolved' then 'verified_for_quantity' else 'incomplete' end,
      'price_completeness',case when v_status='resolved' then 'source_rows_available' else 'unverified' end,
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
revoke all on function public.refresh_reconciliation_cases_for_service(uuid) from public,anon,authenticated;
grant execute on function public.refresh_reconciliation_cases_for_service(uuid) to service_role;
