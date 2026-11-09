# Build253 — prioritize the selected period total during refresh

2026-11-09. Continue work/performance-detail-render-234 from250c9dec, main/application e401846/live252. Verified refs, clean worktree, Build252 handoff, live version.json, passed final-SHA work CI and Pages. Main's identical-commit CI rerun was still active; no second implementation was running.

## Measured cause and change
Followed the recorded refresh critical-path hypothesis, not another corporate-query benchmark. Candidate priorities: (1) selected total queued behind nested realized-sales and home-review reads; (2) repeated whole-content renders; (3) per-position swing-price reads after enrichment. Only(1) changed.

Refreshing retained results synchronously renders them, which can request realized details before changeStockPeriod registers the selected total. The serialized calculation tail then waits while home-review reads occupy the three-slot network queue. Register the total request before rendering the retained view, and give its existing microtask a turn before starting enrichment. Preserve the concurrency limit, all queries/payloads, cache invalidation, cancellation predicates, failure handling and calculation definitions. Recheck owner/load identity before deferred enrichment starts. Existing old-result flags prevent stale totals/realized components being presented as current. No DB or financial-row changes, no new UI.

A one-microtask-only experiment did not resolve the delayed-review case and was not shipped by itself; nested realized ordering was the remaining cause. The selected candidate includes both ordering changes.

## Local evidence
Actual stored-session/login, request queue and renderers with locally intercepted synthetic data. Chromium,390x844,no CPU throttle,50ms response delay,50 holdings, five refreshes per condition. A MutationObserver detects the fresh correct subtotal, followed by two animation frames. Previous diagnostic controller polling was not used for this comparison. Render timing records outer calls only to avoid double-counting recursive rendering. These are synthetic client timings, not production RPC/DB performance.

- Baseline normal first-paint median544.8ms, range511.2–571.8; delayed three home-review responses (+1000ms each)1448.4ms, range1444.6–1476.3. Selected-total queue waits about115ms and1063ms respectively.
- Candidate first paint approximately392ms normal and378ms delayed-review (full raw samples retained by the browser comparison workflow);98 total requests and one selected-total request per refresh retained.
- Earlier exploratory3-run50-position measurements across1W/1M/3M/ALL: a1000ms core delay or selected-P&L delay extends correct paint about1000ms; delayed home-chart response extends completion but does not delay the fresh total. Those exploratory fixtures had fixed account totals and nested inclusive render sums, so their render sums are not a precise rendering breakdown or release comparison. Final diagnostic uses coherent synthetic account totals and outer-only render spans.
- A first review-delay probe unintentionally delayed per-position swing-price reads too; stopped and narrowed it to the three unfiltered home-review reads. That aborted probe is excluded from release figures.

Local selected-total/nested-render regression, existing superseded calculation queue, staged startup, refresh isolation, and version-marker checks passed. No p95/memory-peak/real-iPhone claim.

## Release gates and next action
Pending: alternating before/after comparison in Chromium and WebKit for1W/1M/3M/ALL, five runs/version/period/condition with50 holdings; final mandatory CI including390/402/430px and125%; fresh main lease; Pages and live markers. Do not report deployed until verified.
Next: retain request/paint traces to inspect repeated rendering and the50 swing-price reads without delaying price alerts, first interaction, or hiding freshness. Do not repeat the corporate-query experiment. Preserve Build251 reconciliation and Build245 estimate semantics.
