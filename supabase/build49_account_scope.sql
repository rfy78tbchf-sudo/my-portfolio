-- Read-only account scope for the exact saved observation. The broker account
-- range is not certified until its identifiers are independently reconciled.
create or replace function public.get_live_account_scope()
returns jsonb language sql stable security invoker set search_path to '' as $$
with target as (
  select s.account_id,s.snapshot_date,s.snapshot_at,s.total_assets,s.cash,s.securities_value
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
  select m.user_id,sum(m.total_assets) total_assets,count(*) account_count
  from (
    select distinct on (x.subaccount_key) x.user_id,x.total_assets
    from public.manual_subaccount_snapshots x
    join target t on x.snapshot_date<=t.snapshot_date
    join public.accounts a on a.id=t.account_id and a.user_id=x.user_id
    where x.active order by x.subaccount_key,x.snapshot_date desc,x.snapshot_at desc
  ) m group by m.user_id
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
  'overlay_matches_manual',s.has_source_log and m.total_assets=(s.detail->>'manual_overlay_assets')::numeric,
  'broker_account_overlap_verified',false,
  'method','saved_app_total_minus_exact_sync_manual_overlay'
) from matched s left join manual m on true;
$$;
revoke all on function public.get_live_account_scope() from public,anon;
grant execute on function public.get_live_account_scope() to authenticated;
