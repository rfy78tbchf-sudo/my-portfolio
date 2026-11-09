# Build253 — prioritize the selected period total during refresh

2026-11-09. Continue work/performance-detail-render-234 from250c9dec, main/application e401846/live252. Verified refs, clean worktree, Build252 handoff, live version.json, passed final-SHA work CI and Pages. Main's identical-commit CI rerun was still active; no second implementation was running.

## Measured cause and change
Followed the recorded refresh critical-path hypothesis, not another corporate-query benchmark. Candidate priorities: (1) selected total queued behind nested realized-sales and home-review reads; (2) repeated whole-content renders; (3) per-position swing-price reads after enrichment. Only(1) changed.

The serialized calculation tail resolves its next interactive request through promise callbacks. Synchronously refilling the shared read queue can start queued home-review reads in the newly freed slot before that interactive request reaches the queue. After an interactive priority read only, refill on a zero-delay task, allowing settled promise callbacks to enqueue the next priority calculation first. Ordinary read completions still refill synchronously, avoiding per-request timer overhead. Keep the existing realized/total calculation order and three-request concurrency cap, all payloads, cache invalidation, owner/cancellation predicates, retained-result flags and failure handling. No DB/financial-row changes or new UI.

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

The corrected broad-refill candidate50a6b25 passed both-browser comparison and first-view switching, but normal WebKit refresh medians increased6–20ms. Narrowed the yield to priority-read completions only; ordinary completion remains synchronous and has an explicit unit regression. Earlier broad-refill comparisons are diagnostic only, not the final release figures. The final candidate must pass its own complete CI and corrected alternating browser comparison.

## Verified deployment

Build253 deployed at2026-11-09 12:13UTC (21:13KST). Application/main `bbe82e7c68d90adec905de1c295c05dec1e2ebf3`.

- [Final application CI42613003569](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42613003569): decision-regression and mobile passed, including both browsers,390/402/430px,125%, rapid switching, historical-cost/FX/settlement correctness, startup/refresh/detail/chart/wealth regressions.
- [Comparison42613004016](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42613004016): passed on the same final application SHA.
- Re-read main `e401846` and work `bbe82e7`; guarded non-force fast-forward succeeded.
- [Pages42614938566](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42614938566): success on `bbe82e7`.
- Fresh no-cache HTTP reads verified version.json and HTML/appBuild `2026-11-09-period-refresh-priority-253`, actual priority-yield implementation, and SW `my-portfolio-shell-2026110906-253`.
- Main's automatically triggered identical-SHA CI42614938993 was still running at handoff; the required work-branch CI for that exact SHA passed before promotion. Do not redeploy for that duplicate run. This documentation/data-only follow-up uses `[skip ci]`; main remains the tested application commit.

## Final-commit measurement evidence

Application commit `bbe82e7c68d90adec905de1c295c05dec1e2ebf3`; baseline `e40184641247db15abbca21e9e31b92adb20b7bd` (Build252). Corrected fixture, Ubuntu24.04, Playwright1.55.1 Chromium/WebKit sequential,390x844,no CPU/network throttle beyond the same intercepted50ms response delay. Fifty synthetic holdings; normal responses or1000ms added to three home-review responses. Five alternating samples per version/period/condition:160 refresh samples total. Request start to fresh correct partial subtotal in DOM plus two animation frames. All API traffic intercepted; these are not production DB/RPC/network measurements.

| Browser | Period | Condition | Before median (min–max), ms | After median (min–max), ms |
|---|---|---|---:|---:|
| chromium | 1W | none | 425.0 (420.4–431.0) | 424.6 (406.9–433.7) |
| chromium | 1W | reviews | 1370.0 (1353.6–1743.5) | 421.2 (414.3–426.4) |
| chromium | 1M | none | 426.1 (423.6–813.4) | 431.4 (422.1–810.8) |
| chromium | 1M | reviews | 1357.2 (1347.2–1365.7) | 417.8 (411.1–424.2) |
| chromium | 3M | none | 424.1 (411.8–427.8) | 414.7 (402.2–810.8) |
| chromium | 3M | reviews | 1350.8 (1345.9–1366.0) | 417.9 (404.1–431.9) |
| chromium | ALL | none | 426.9 (413.4–430.6) | 422.6 (408.5–807.2) |
| chromium | ALL | reviews | 1347.7 (1344.6–1354.6) | 416.6 (413.3–421.7) |
| webkit | 1W | none | 368.0 (357.0–386.0) | 367.0 (353.0–368.0) |
| webkit | 1W | reviews | 1314.0 (1306.0–1316.0) | 362.0 (355.0–363.0) |
| webkit | 1M | none | 367.0 (359.0–372.0) | 363.0 (358.0–374.0) |
| webkit | 1M | reviews | 1318.0 (1307.0–1323.0) | 369.0 (362.0–372.0) |
| webkit | 3M | none | 366.0 (352.0–368.0) | 363.0 (360.0–368.0) |
| webkit | 3M | reviews | 1304.0 (1303.0–1315.0) | 356.0 (352.0–359.0) |
| webkit | ALL | none | 361.0 (352.0–368.0) | 364.0 (352.0–377.0) |
| webkit | ALL | reviews | 1312.0 (1300.0–1331.0) | 363.0 (354.0–369.0) |

Raw synthetic samples, queue/response spans and outer render totals are committed in [performance/build253-refresh-comparison.json](performance/build253-refresh-comparison.json). [Final comparison CI](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42613004016) passed. Do not use rejected or broad-refill candidate timings as release evidence.

In delayed-review samples (20 per browser/version across the four periods), the selected-total queue median fell1059.5→110.6ms in Chromium and1057→107ms in WebKit. Response medians54.1→66.6ms and52.5→52ms; no backend speed claim. Nine outer render calls and98 requests including exactly one period-total RPC in every sample. Full refresh completion medians: normal Chromium1956→1947ms/WebKit1822→1824.5ms; delayed reviews2946.6→2911.2ms/2820.5→2803ms. The large improvement is earlier correct P&L display, not removal of background work.

Normal medians overlap. Chromium has isolated~807–813ms samples in both versions; traces place the extra delay before the priority handoff (one current-account response441.8ms; other samples reach pending-event request around584–605ms rather than~200ms). Preserve these outliers; do not claim normal-case or tail-latency improvement or estimate p95 from five samples. WebKit normal medians remain361–368ms before and363–367ms after. Peak memory, real iPhone/PWA restart, native keyboard and Face ID were not measured.

A held-total first-interaction probe passed in both browsers: switching immediately to realized details exposed already-fresh state. Queue unit regression preserves calculation order, cap3, ordinary synchronous refill, drained timers and account isolation. Legacy VM queue fixture now supplies browser setTimeout; prior broad-candidate full CI failed because that browser global was missing, and was not deployed.

Additional final-source local Chromium checks: four synthetic holdings, three runs per condition/period,52 requests each. Correct results in1W/1M/3M/ALL with normal and delayed reviews. Existing build67 screens passed390/402/430px,125%, chart touch and keyboard. These extra checks are not an independent before/after speed claim.

## Next measured hypothesis

In the same execution, `tests/refresh_swing_followup253.mjs` instrumented the corrected synthetic harness (Chromium,50 holdings,50ms responses,1W,three runs). Fifty per-security swing-price reads account for50/98 refresh requests. Swing phase997.2/1008.6/997.3ms; refresh completion2345.0/2346.2/2379.6ms; correct P&L paint662.1/639.1/667.2ms. This phase follows P&L paint and updates price alerts and persisted/read state. It was measured, not optimized.

Next action: prototype a bounded bulk history read and compare against the existing per-security160-row descending query/reversal. Preserve per-security limits and chronology, account authorization, failure isolation, alert timing and response truncation detection; do not simply defer or remove it. No live financial data writes. Do not repeat completed corporate-query benchmarks or reimplement Build245/251/wealth goals.
