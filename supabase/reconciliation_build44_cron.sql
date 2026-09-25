-- Completed SWQA months get an independent, resumable SPQM2205 evidence pass.
-- The worker records each month's completion after every page and DB write succeed.
select cron.schedule('kb-secondary-evidence-backfill','*/2 * * * *',$job$
  select net.http_post(
    url:='https://buimrsjowlmfkxxaithj.supabase.co/functions/v1/kb-sync-worker',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-internal-sync-key',public.get_kb_internal_sync_key_for_service()),
    body:='{"action":"backfill-evidence-next","months":2}'::jsonb,
    timeout_milliseconds:=120000)
  where exists(select 1 from public.kb_backfill_months where evidence_checked_at is null);
$job$);

-- Prior two months are revisited daily for delayed postings and corrections.
select cron.schedule('kb-recheck-recent-position-history','40 1 * * *',$job$
  select net.http_post(
    url:='https://buimrsjowlmfkxxaithj.supabase.co/functions/v1/kb-sync-worker',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-internal-sync-key',public.get_kb_internal_sync_key_for_service()),
    body:='{"action":"recheck-recent-history"}'::jsonb,
    timeout_milliseconds:=120000);
$job$);
