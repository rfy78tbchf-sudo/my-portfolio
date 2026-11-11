# Build255 in-flight delay investigation — 2026-11-10 KST

Fresh main42c5f46a448a30d5bba66bf4f7cd578d4d25aa94; existing branch e9f29faec2fe685fb7c4446003fc78be5cf7185d. Public version.json still2026-11-10-render-scroll-255. Pages42654315576 succeeded. Main CI42654317839 attempt2 finished successfully, including the previously failed WebKit decision restoration step. Its initial timeout remains unexplained; do not call it fixed or remove regression coverage. No running run among the latest four. No operational financial data accessed and no product code modified.

## Measured hypothesis

`experiments/period-delay255.mjs` extends the actual startup/auth/queue/full-render browser harness. Browser clicks choose an old period, wait until its request really starts, wait40ms, then click the new period. Each period returns a distinct subtotal, so a stale period cannot satisfy the display assertion. Previous response has600ms extra synthetic delay plus the standard50ms mock service; latest response has50ms. Measure from immediately before the latest click through correct subtotal/selected state plus two animation frames. After every response settles, assert the latest amount and partial marker remain correct. Also assert a repeated period uses no stock-total RPC, and aging both cache timestamps31s triggers exactly one new stock-total RPC. No timeout increase or guard weakening.

Chromium390x844,no CPU throttle,4 synthetic holdings,1W/1M/3M/ALL,5 samples per target per scope,20 per scope,40 total per source. The application renderer is not timing-wrapped; RPC trace instrumentation remains. Scope all retains Build254's unverified whole-account contract; the numerical assertion applies to its stock subtotal, not an independently verified whole-account profit. Raw traces are committed. This is a controlled in-flight delay, not evidence that operating-server delays have this frequency or distribution. No p95 production claim.

| Source | Scope | Latest-click to correct subtotal median/min/max ms | Latest stock RPC queue median ms |
|---|---|---|---|
|Build255|stocks|712.7 /699.8 /732.2|573.4|
|Build255|all|715.9 /698.9 /718.8|573.1|
|counterfactual parallel|stocks|133.2 /124.7 /150.4|0.2|
|counterfactual parallel|all|133.2 /129.0 /148.5|0.2|

Each switch starts exactly two stock-total RPCs (old and latest); queued obsolescence, repeated cache reuse and TTL invalidation assertions pass. The running request cannot be skipped by the existing pre-dispatch predicate. It holds stockCalculationTail until it finishes, explaining the measured client wait. These queue timings include client wait, and mock response timings include injected service; do not label either real DB/network processing.

## Counterfactual and decision

`experiments/period-parallel-prototype255.mjs` substitutes Promise.resolve for stockCalculationTail only in a temporary HTML file. It is an isolation experiment, NOT a safe deployment candidate. It demonstrates that serialization causes most of this controlled delay, and exercises a newer response completing before the older one; the old response does not overwrite the current UI. It removes the existing one-calculation-at-a-time invariant, potentially overlapping heavy old/new SQL and realized calculations. Existing three-read pool is not equivalent to the calculation concurrency guarantee. No server capacity, query cancellation, lock contention or actual SQL concurrency evidence was collected. Aborting fetch alone cannot be treated as proof that database work stops. Do not deploy this prototype or claim133ms operating latency.

Keep Build255. The next justified task is to inspect why calculation serialization was introduced, then use isolated synthetic SQL/concurrency tests to compare bounded latest-request overlap with existing serialization, including error/timeout/auth/day-change paths and total server work. A safe candidate must preserve resource limits and financial definitions rather than simply removing the tail. Alternatively evaluate server-side reuse/cancellation only after establishing its actual semantics. Do not repeat the100/1000 response-size benchmark or unrelated layout work while this quantified in-flight wait remains the strongest hypothesis. Current tests cover cache expiry and late response; auth/day boundaries remain in existing tests/build248_period_queue.mjs and need inclusion in any new cancellation design.

No new deployment, production speed improvement, database cancellation or physical iPhone validation is claimed by this follow-up. The initial harness startup equality was adjusted to accept the new period-distinct synthetic values before collecting results; no application condition was changed.
