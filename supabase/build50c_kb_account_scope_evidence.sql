-- Owner-supplied KB account breakdown, 2026-09-26 11:42 KST.
-- Store totals and linked internal account IDs, never broker account numbers.
create table if not exists public.kb_account_scope_evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  manual_account_id uuid not null references public.accounts(id),
  linked_snapshot_at timestamptz not null,
  broker_capture_at timestamptz not null,
  broker_primary_total numeric not null,
  broker_isa_total numeric not null,
  broker_aggregate_total numeric not null,
  source_reference text not null,
  created_at timestamptz not null default now(),
  constraint kb_account_scope_sum_check check (broker_primary_total+broker_isa_total=broker_aggregate_total),
  constraint kb_account_scope_unique unique(account_id,manual_account_id,linked_snapshot_at,source_reference)
);
alter table public.kb_account_scope_evidence enable row level security;
create policy kb_account_scope_evidence_owner_read on public.kb_account_scope_evidence
  for select to authenticated using (exists (
    select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())
  ));
revoke all on public.kb_account_scope_evidence from public,anon;
grant select on public.kb_account_scope_evidence to authenticated;

-- Insert only when the saved API response for the precise observation equals
-- the broker's separately displayed primary account. The later ISA valuation
-- is evidence of distinct accounts, not a replacement for the older manual NAV.
insert into public.kb_account_scope_evidence (
  account_id,manual_account_id,linked_snapshot_at,broker_capture_at,
  broker_primary_total,broker_isa_total,broker_aggregate_total,source_reference
)
select a.id,manual.id,s.snapshot_at,'2026-09-26 11:42:00+09'::timestamptz,
  55538715,9150078,64688793,'owner_kb_account_breakdown_IMG_9346'
from public.accounts a
join public.accounts manual on manual.user_id=a.user_id and manual.mode='live'
  and manual.provider='kb_securities_manual' and manual.is_active
join public.daily_account_snapshots s on s.account_id=a.id
join public.sync_logs l on l.account_id=a.id and l.scope='kb_current_snapshot'
  and l.status='success' and l.started_at=s.snapshot_at
where a.mode='live' and a.provider='kb_securities' and a.is_active
  and s.snapshot_at='2026-09-26 00:10:03.561826+00'::timestamptz
  and s.total_assets-(l.detail->>'manual_overlay_assets')::numeric=55538715
  and (l.detail->>'manual_overlay_assets')::numeric=9128990
on conflict (account_id,manual_account_id,linked_snapshot_at,source_reference) do nothing;

create or replace function public.get_live_account_scope()
returns jsonb language sql stable security invoker set search_path to '' as $$
with target as (
  select s.account_id,s.snapshot_date,s.snapshot_at,s.total_assets,s.cash,s.securities_value,
    a.user_id
  from public.daily_account_snapshots s
  join public.accounts a on a.id=s.account_id
  where a.user_id=(select auth.uid()) and a.mode='live'
    and a.provider='kb_securities' and a.is_active
  order by s.snapshot_at desc limit 1
), matched as (
  select t.*,l.detail,(l.started_at is not null) has_source_log
  from target t left join lateral (
    select x.started_at,x.detail from public.sync_logs x
    where x.account_id=t.account_id and x.scope='kb_current_snapshot'
      and x.status='success' and x.started_at=t.snapshot_at
    order by x.id desc limit 1
  ) l on true
), manual as (
  select m.user_id,sum(m.total_assets) total_assets,count(*) account_count,
    max(m.snapshot_at) latest_observed_at
  from (
    select distinct on (x.subaccount_key) x.user_id,x.total_assets,x.snapshot_at
    from public.manual_subaccount_snapshots x
    join target t on x.snapshot_date<=t.snapshot_date and x.user_id=t.user_id
    where x.active order by x.subaccount_key,x.snapshot_date desc,x.snapshot_at desc
  ) m group by m.user_id
), evidence as (
  select e.* from target t
  join public.kb_account_scope_evidence e on e.account_id=t.account_id
  join public.accounts ma on ma.id=e.manual_account_id and ma.user_id=t.user_id
    and ma.mode='live' and ma.provider='kb_securities_manual' and ma.is_active
  where e.linked_snapshot_at<=t.snapshot_at
    and exists (
      select 1 from public.daily_account_snapshots ss
      join public.sync_logs ll on ll.account_id=ss.account_id
        and ll.started_at=ss.snapshot_at and ll.scope='kb_current_snapshot'
        and ll.status='success'
      where ss.account_id=t.account_id and ss.snapshot_at=e.linked_snapshot_at
        and ss.total_assets-(ll.detail->>'manual_overlay_assets')::numeric=e.broker_primary_total
    )
  order by e.linked_snapshot_at desc limit 1
)
select jsonb_build_object(
  'ok',true,'snapshot_at',s.snapshot_at,'snapshot_date',s.snapshot_date,
  'app_display_total',s.total_assets,'app_display_cash',s.cash,
  'app_display_securities',s.securities_value,
  'kb_response_total',case when s.has_source_log and s.detail ? 'manual_overlay_assets'
    then s.total_assets-(s.detail->>'manual_overlay_assets')::numeric else null end,
  'overlay_logged',case when s.has_source_log and s.detail ? 'manual_overlay_assets'
    then (s.detail->>'manual_overlay_assets')::numeric else null end,
  'manual_current_total',m.total_assets,'manual_count',m.account_count,
  'manual_observed_at',m.latest_observed_at,
  'manual_snapshot_stale',m.latest_observed_at<s.snapshot_at,
  'overlay_matches_manual',s.has_source_log and m.total_assets=(s.detail->>'manual_overlay_assets')::numeric,
  'broker_account_overlap_verified',coalesce(e.id is not null and s.has_source_log
    and m.account_count=1 and m.total_assets=(s.detail->>'manual_overlay_assets')::numeric,false),
  'broker_scope_capture_at',e.broker_capture_at,
  'broker_scope_primary_value',e.broker_primary_total,
  'broker_scope_isa_value',e.broker_isa_total,
  'broker_scope_total_value',e.broker_aggregate_total,
  'broker_scope_evidence_source',e.source_reference,
  'method',case when e.id is not null then 'linked_broker_account_breakdown_plus_manual_overlay'
    else 'saved_app_total_minus_exact_sync_manual_overlay' end
) from matched s left join manual m on m.user_id=s.user_id
  left join evidence e on e.account_id=s.account_id;
$$;
revoke all on function public.get_live_account_scope() from public,anon;
grant execute on function public.get_live_account_scope() to authenticated;

-- Keep the canonical decision metric's account definition in step with the
-- evidence, while retaining a reference qualifier for the older manual ISA NAV.
create or replace function public.get_live_decision_metrics(
  p_symbol text default 'ARM', p_change_pct numeric default -10)
returns jsonb language plpgsql stable security invoker set search_path to '' as $fn$
declare
  v_account uuid;
  v_scope jsonb;
  v_as_of timestamptz;
  v_total numeric;
  v_missing integer;
  v_stale integer;
  v_position numeric;
  v_top_three numeric;
  v_symbol text := upper(trim(coalesce(p_symbol,'')));
  v_broker_separate boolean;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_symbol !~ '^[A-Z0-9.]{1,15}$' or p_change_pct is null
    or p_change_pct < -90 or p_change_pct > 100 then
    raise exception 'invalid scenario inputs';
  end if;
  select a.id into v_account from public.accounts a
  where a.user_id=(select auth.uid()) and a.mode='live'
    and a.provider='kb_securities' and a.is_active
  order by a.created_at limit 1;
  if v_account is null then return jsonb_build_object('ok',false,'reason','NO_ACCOUNT'); end if;
  v_scope:=public.get_live_account_scope();
  v_as_of:=(v_scope->>'snapshot_at')::timestamptz;
  v_total:=(v_scope->>'app_display_total')::numeric;
  v_broker_separate:=coalesce((v_scope->>'broker_account_overlap_verified')::boolean,false);
  if v_as_of is null or v_total is null or v_total<=0 then
    return jsonb_build_object('ok',false,'reason','NO_ALIGNED_ASSETS');
  end if;
  with positions as (
    select h.security_id,s.symbol,h.valuation_krw,h.as_of
    from public.live_holding_display_basis h
    join public.securities s on s.id=h.security_id
    where h.account_id=v_account and h.quantity>0
  ), by_security as (
    select symbol,sum(valuation_krw) val,count(*) filter (where valuation_krw is null) missing,
      count(*) filter (where as_of is distinct from v_as_of) stale
    from positions group by symbol
  ), ranked as (
    select *,row_number() over(order by val desc nulls last,symbol) rank from by_security
  )
  select coalesce(sum(missing),0)::integer,coalesce(sum(stale),0)::integer,
    sum(val) filter (where symbol=v_symbol),sum(val) filter (where rank<=3)
  into v_missing,v_stale,v_position,v_top_three from ranked;
  if v_missing>0 or v_stale>0 then
    return jsonb_build_object('ok',false,'reason','POSITION_VALUATION_NOT_ALIGNED',
      'missing',v_missing,'stale',v_stale,'observed_at',v_as_of);
  end if;
  if v_position is null then return jsonb_build_object('ok',false,'reason','SYMBOL_NOT_HELD'); end if;
  return jsonb_build_object(
    'ok',true,'calculation_version','decision-metrics-v2',
    'observation_at',v_as_of,'account_scope','KB 자동계좌 보유 + 앱 저장 자산 분모',
    'account_scope_state',case when v_broker_separate then 'verified' else 'isa_overlap_unverified' end,
    'denominator',jsonb_build_object('metric_id','app_display_assets','value',v_total,
      'currency','KRW','label',case when v_broker_separate
        then 'KB 자동계좌 + ISA 수동잔고 (기준시각 다름)'
        else '앱 합산 자산 (ISA 포함 여부 미확인)' end,
      'kb_response_value',v_scope->'kb_response_total',
      'manual_overlay',v_scope->'overlay_logged','observed_at',v_as_of,
      'manual_observed_at',v_scope->'manual_observed_at',
      'broker_scope_capture_at',v_scope->'broker_scope_capture_at',
      'account_scope_state',case when v_broker_separate then 'separate_accounts_observed'
        else 'not_verified' end),
    'position',jsonb_build_object('metric_id','position_value:'||v_symbol,
      'symbol',v_symbol,'value',v_position,'currency','KRW',
      'weight_pct',round(v_position/v_total*100,4)),
    'top_three',jsonb_build_object('metric_id','top_three_value','value',v_top_three,
      'currency','KRW','weight_pct',round(v_top_three/v_total*100,4)),
    'scenario',jsonb_build_object('metric_id','scenario:'||v_symbol||':'||p_change_pct,
      'assumption_pct',p_change_pct,'impact_krw',v_position*p_change_pct/100,
      'asset_impact_pct',round(v_position*p_change_pct/v_total,4),
      'assumption','해당 종목 원화 평가액만 변하고 나머지 자산은 동일',
      'state','conditional_reference_not_forecast'));
end $fn$;
revoke all on function public.get_live_decision_metrics(text,numeric) from public,anon;
grant execute on function public.get_live_decision_metrics(text,numeric) to authenticated;
