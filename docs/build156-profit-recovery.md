# Build156: profit timeout and staged-load recovery

Production logs at 2026-10-07 01:24 UTC identify statement timeouts in both get_live_period_stock_pnl and get_live_realized_sales (plus background reconciliation). The authenticated/API default is 8 seconds.

Changes:
- Limit concurrent read requests to three, with requested stock P&L/realized queries prioritized. Mutations retain existing execution behavior. Both queues reject reads from an expired auth epoch.
- Add account/security/effective-date and pending-settlement matching indexes; disable JIT in realized-sales calculation. Only the two expensive report functions have a 20-second statement timeout and a 25-second client transport deadline.
- Remove the realized UI watchdog that counted time waiting behind a different calculation as a failure. Transport retains its deadline.
- Initialize stockPnl at core paint; prevent enrichment from replacing on-demand stock/today results with null; invalidate old request epochs before rendering core.

Verification:
- Authenticated owner-scoped THIS_MONTH queries return ok=true: 12 period items and 10 sale candidates. These are current query counts, not a completeness assertion.
- Exact full JSON before/after index/JIT changes was equal for both THIS_MONTH responses in a rolled-back transaction.
- Post-change realized-sales SQL execution: 1.855 seconds in an isolated warmed request. This is not an iPhone latency measurement. Prior isolated request was 1.752 seconds, so no index speedup is claimed; concurrency control and bounded timeout headroom address the observed failures.
- Regression tests cover bounded concurrency, priority, auth isolation, enrichment races, period cache/retry and separated realized views.
- Existing decision flow tests cover integer-share comparison, context-matched AI reuse, saved comparison validation and expired-condition review. Live owner decisions were not fabricated for testing.
- Local browser executable crashed before launch; browser/visual CI remains pending because publication was blocked by automatic approval review.
- Existing rollback-only synthetic authenticated database fixture passed: integer-share comparison, decision save/readback, idempotent retry, and rejection of a changed comparison. All fixture rows rolled back. No real model call was made.
- Prepared frontend commit 49e73ea; remote main remains 321a799. Automatic approval review rejected the direct main push pending explicit deployment authorization. Database changes above were already applied successfully.

Security advisor was checked: existing notices concern pg_net placement, four pre-existing definer functions, password leak protection, and policy-free locked tables. This change adds no grants or authorization behavior. Remediation references: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security .
