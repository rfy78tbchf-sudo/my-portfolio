# Period P&L timeout recovery

PostgREST logs confirmed statement timeouts inside the stock P&L function and a realized-sales caller. The function now disables JIT and uses a scoped 16 MB work buffer, avoiding repeated temporary-file reads observed in its execution plan. Invoker security, RLS, calculation SQL, and grants remain unchanged.

The client serializes expensive P&L calls and loads today’s stock P&L on demand. Failed period requests have a local retry button; duplicate taps and stale period, day, or snapshot responses are guarded.

Validation: exact full JSON fingerprints match before and after for this month, all history, and today. Authenticated execution-plan checks completed in roughly 1–3 seconds with tuned settings. Recovery and financial regression tests pass; mobile workflow verifies the published build. This does not remove the database timeout limit or guarantee latency under every future load.
