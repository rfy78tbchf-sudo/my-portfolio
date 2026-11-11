-- UTC. Refresh this month's KB ledger shortly after each official balance
-- snapshot (00:10, 03:10, 06:10, 09:10, 12:10 UTC). Keep an evening retry.
-- The existing job command and its Vault-backed internal authentication stay
-- unchanged; a completed historical backfill is not a live-ledger refresh.
select cron.alter_job(
  job_id => (select jobid from cron.job
    where jobname='kb-current-month-history-sync'),
  schedule => '20 0,3,6,9,12,13 * * *'
);
