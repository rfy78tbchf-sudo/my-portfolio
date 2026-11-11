-- Cash reconciliation is independent of investment P&L. Never allocate its
-- residual to returns. Its dates are broker ledger dates, pending settlement.
create or replace view public.live_cash_observation_bridges
with (security_invoker=true) as
with latest as (
  select distinct on (o.account_id,o.balance_date)
    o.account_id,o.balance_date,o.cash_krw,o.foreign_cash,o.fetched_at
  from public.account_observations o where o.cash_krw is not null
  order by o.account_id,o.balance_date,o.fetched_at desc
), intervals as (
  select o.*,lag(o.balance_date) over(partition by o.account_id order by o.balance_date) start_date,
    lag(o.cash_krw) over(partition by o.account_id order by o.balance_date) opening_krw
  from latest o
)
select i.account_id,i.start_date,i.balance_date end_date,i.opening_krw,
  i.cash_krw closing_krw,i.cash_krw-i.opening_krw observed_change_krw,
  coalesce(e.delta_krw,0) ledger_change_krw,
  i.cash_krw-i.opening_krw-coalesce(e.delta_krw,0) difference_krw,
  coalesce(e.delta_usd,0) known_usd_movement,
  coalesce(e.event_count,0) event_count,
  coalesce(e.trade_count,0) trade_count,
  coalesce(e.flow_count,0) external_flow_count,
  case when abs(i.cash_krw-i.opening_krw-coalesce(e.delta_krw,0))<=1 then 'matched'
    when coalesce(e.trade_count,0)>0 then 'settlement_or_account_reflection_candidate'
    when coalesce(e.flow_count,0)>0 then 'external_flow_reflection_candidate'
    else 'source_data_insufficient' end status
from intervals i
left join lateral (
  select sum(e.amount) filter(where e.currency='KRW') delta_krw,
    sum(e.amount) filter(where e.currency='USD') delta_usd,
    count(*) event_count,
    count(*) filter(where e.event_type in ('buy','sell')) trade_count,
    count(*) filter(where e.component='external') flow_count
  from public.live_cash_ledger_events e
  where e.account_id=i.account_id and e.event_date>i.start_date and e.event_date<=i.balance_date
) e on true
where i.start_date is not null;

create table if not exists public.cash_reconciliation_errors (
  account_id uuid not null references public.accounts(id),
  start_date date not null,
  end_date date not null,
  opening_krw numeric not null,
  closing_krw numeric not null,
  ledger_change_krw numeric not null,
  difference_krw numeric not null,
  cause_candidate text not null,
  status text not null check(status in ('open','resolved')),
  checked_at timestamptz not null default now(),
  primary key(account_id,start_date,end_date)
);
alter table public.cash_reconciliation_errors enable row level security;
create policy "Owner reads cash errors" on public.cash_reconciliation_errors for select
to authenticated using (exists (
  select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())
));
revoke all on public.cash_reconciliation_errors from public,anon,authenticated;
grant select on public.cash_reconciliation_errors to authenticated;
grant all on public.cash_reconciliation_errors to service_role;
revoke all on public.live_cash_observation_bridges from public,anon;
grant select on public.live_cash_observation_bridges to authenticated;

create or replace function public.refresh_cash_reconciliation_for_service(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_account uuid; v_count int; v_largest numeric;
begin
  select a.id into v_account from public.accounts a
  where a.user_id=p_user_id and a.mode='live' and a.is_active
  order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_LIVE_ACCOUNT'); end if;
  insert into public.cash_reconciliation_errors as current_error
    (account_id,start_date,end_date,opening_krw,closing_krw,ledger_change_krw,
     difference_krw,cause_candidate,status,checked_at)
  select b.account_id,b.start_date,b.end_date,b.opening_krw,b.closing_krw,
    b.ledger_change_krw,b.difference_krw,b.status,
    case when abs(b.difference_krw)>1 then 'open' else 'resolved' end,now()
  from public.live_cash_observation_bridges b where b.account_id=v_account
  on conflict (account_id,start_date,end_date) do update
    set opening_krw=excluded.opening_krw,closing_krw=excluded.closing_krw,
    ledger_change_krw=excluded.ledger_change_krw,difference_krw=excluded.difference_krw,
    cause_candidate=excluded.cause_candidate,status=excluded.status,checked_at=now();
  select count(*),max(abs(e.difference_krw)) into v_count,v_largest
  from public.cash_reconciliation_errors e
  where e.account_id=v_account and e.status='open';
  return jsonb_build_object('ok',true,'open_periods',v_count,'largest_gap_krw',v_largest);
end $fn$;
revoke all on function public.refresh_cash_reconciliation_for_service(uuid) from public,anon,authenticated;
grant execute on function public.refresh_cash_reconciliation_for_service(uuid) to service_role;
