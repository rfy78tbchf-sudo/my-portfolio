-- Complete missing official KB statement months at a controlled pace. The
-- worker records each finished month and does not reread completed months.
-- The schedule becomes a no-op once all months are present.
select cron.schedule('kb-history-backfill-build42','*/5 * * * *',$job$
  select net.http_post(
    url:='https://buimrsjowlmfkxxaithj.supabase.co/functions/v1/kb-sync-worker',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-internal-sync-key',public.get_kb_internal_sync_key_for_service()),
    body:='{"action":"backfill-next","months":3}'::jsonb,
    timeout_milliseconds:=120000)
  where exists (
    select 1 from public.accounts a
    where a.mode='live' and a.provider='kb_securities'
      and (select count(*) from public.kb_backfill_months b where b.user_id=a.user_id)
        < (select count(*) from generate_series(
          '2020-07-01'::date,date_trunc('month',now() at time zone 'Asia/Seoul')::date,
          '1 month'::interval))
  );
$job$);
