-- Compare the current API response with the immutable broker screenshot. A new
-- same-day refresh may replace the linked historical daily snapshot; that must
-- not erase the evidence. Equality by amount does not prove account IDs.
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
  select e.* from matched s
  join public.kb_account_scope_evidence e on e.account_id=s.account_id
  join public.accounts ma on ma.id=e.manual_account_id and ma.user_id=s.user_id
    and ma.mode='live' and ma.provider='kb_securities_manual' and ma.is_active
  where e.linked_snapshot_at<=s.snapshot_at
    and s.has_source_log and s.detail ? 'manual_overlay_assets'
    and e.broker_primary_total=s.total_assets-(s.detail->>'manual_overlay_assets')::numeric
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
  'method',case when e.id is not null then 'broker_screen_amount_match_identifier_unverified'
    else 'saved_app_total_minus_exact_sync_manual_overlay' end
) from matched s left join manual m on m.user_id=s.user_id
  left join evidence e on e.account_id=s.account_id;
$$;
revoke all on function public.get_live_account_scope() from public,anon;
grant execute on function public.get_live_account_scope() to authenticated;
