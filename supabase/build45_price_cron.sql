-- Three historically traded securities per hour. Progress prevents the same
-- unsupported broker chart from being requested more than once per 21 days.
select cron.schedule('kb-historical-price-backfill','5 * * * *',$job$
  select net.http_post(
    url:='https://buimrsjowlmfkxxaithj.supabase.co/functions/v1/kb-sync-worker',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-internal-sync-key',public.get_kb_internal_sync_key_for_service()),
    body:='{"action":"sync-history-prices-next","securities":3}'::jsonb,
    timeout_milliseconds:=120000)
  where exists (
    select 1 from public.transactions t
    join public.accounts a on a.id=t.account_id and a.mode='live' and a.is_active
    left join public.price_backfill_progress p
      on p.account_id=t.account_id and p.security_id=t.security_id
    where t.type in ('buy','sell') and t.security_id is not null
      and (p.attempted_at is null or p.attempted_at<now()-interval '21 days')
  );
$job$);
