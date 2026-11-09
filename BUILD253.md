# Build253 — prioritize the selected period total during refresh

2026-11-09. Continue work/performance-detail-render-234 from250c9dec, main/application e401846/live252. Verified refs, clean worktree, Build252 handoff, live version.json, passed final-SHA work CI and Pages. Main's identical-commit CI rerun was still active; no second implementation was running.

## Measured cause and change
Followed the recorded refresh critical-path hypothesis, not another corporate-query benchmark. Candidate priorities: (1) selected total queued behind nested realized-sales and home-review reads; (2) repeated whole-content renders; (3) per-position swing-price reads after enrichment. Only(1) changed.

The serialized calculation tail resolves its next interactive request through promise callbacks. Synchronously refilling the shared read queue can start queued home-review reads in the newly freed slot before that interactive request reaches the queue. Refill on a zero-delay task instead, allowing settled promise callbacks to enqueue the next priority calculation first. Keep the existing realized/total calculation order and three-request concurrency cap, all payloads, cache invalidation, owner/cancellation predicates, retained-result flags and failure handling. No DB/financial-row changes or new UI.

Rejected candidate97cb618 registered the period total before retained-result rendering and deferred enrichment by a microtask. It reduced total latency but regressed an immediate switch to realized details while a slow total was pending: baseline was already fresh; candidate waited about1.1s in a1000ms held-total probe. It is not deployable and was superseded. The final queue-refill change preserves that first interaction. Do not deploy97cb618 on its own or use its comparison as final release evidence.

## Local evidence
Actual stored-session/login, request queue and renderers with locally intercepted synthetic data. Chromium,390x844,no CPU throttle,50ms response delay,50 holdings, five refreshes per condition. A MutationObserver detects the fresh correct subtotal, followed by two animation frames. Previous diagnostic controller polling was not used for this comparison. Render timing records outer calls only to avoid double-counting recursive rendering. These are synthetic client timings, not production RPC/DB performance.

- Baseline normal first-paint median544.8ms, range511.2–571.8; delayed three home-review responses (+1000ms each)1448.4ms, range1444.6–1476.3. Selected-total queue waits about115ms and1063ms respectively.
- Final refill candidate normal first-paint median522.4ms,range506.6–636.0; delayed-review539.7ms,range531.9–568.0. Requests remain98 total and one selected total. Queue waits in the delayed-review case fall from about1063ms to112ms. Normal latency variation overlaps; claim only the reproducible delayed-review improvement.
- A slow-total first-interaction probe switched to realized details after the total request had started. Baseline and final candidate both immediately exposed fresh realized state; rejected97cb618 did not. This is a dependency correctness check, not a meaningful single-sample speed comparison. Final CI requires this assertion in both browsers.
- Earlier exploratory3-run50-position measurements across1W/1M/3M/ALL: a1000ms core delay or selected-P&L delay extends correct paint about1000ms; delayed home-chart response extends completion but does not delay the fresh total. Those exploratory fixtures had fixed account totals and nested inclusive render sums, so their render sums are not a precise rendering breakdown or release comparison. Final diagnostic uses coherent synthetic account totals and outer-only render spans.
- A first review-delay probe unintentionally delayed per-position swing-price reads too; stopped and narrowed it to the three unfiltered home-review reads. That aborted probe is excluded from release figures.

Local queue-refill regression proves preserved serial order, a priority total occupying the freed slot before queued enrichment, maximum concurrency3 and drained timers/queue. Existing superseded calculation queue, staged startup, refresh isolation, and version-marker checks passed. No p95/memory-peak/real-iPhone claim.

The final comparison fixture filters price-history responses by security_id and applies the requested limit. Earlier exploratory local fixtures over-returned price rows for those background reads; local figures above locate the queue dependency but are not the release performance claim. Use only the corrected final-CI comparison for reported timings.

## Release gates and next action
Pending: alternating before/after comparison in Chromium and WebKit for1W/1M/3M/ALL, five runs/version/period/condition with50 holdings; final mandatory CI including390/402/430px and125%; fresh main lease; Pages and live markers. Do not report deployed until verified.
Next: retain request/paint traces to inspect repeated rendering and the50 swing-price reads without delaying price alerts, first interaction, or hiding freshness. Do not repeat the corporate-query experiment. Preserve Build251 reconciliation and Build245 estimate semantics.
