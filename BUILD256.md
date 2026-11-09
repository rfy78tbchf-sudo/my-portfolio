# Build256 — reuse completed period results on return

User trigger: navigate away while a period calculation is running, then return after it finishes. Build255 guarded the obsolete response before caching, so returning performed the same SQL again. Retain successful, matching-period responses in the existing 30-second cache when auth epoch, live snapshot object and KST day still match. Only the current selection can update the visible result. Returning uses the original completion timestamp; it does not renew freshness. Existing data-version invalidation, partial/provisional/null values, request sharing, expired-cache reloads and serialized calculation concurrency1 remain intact. No SQL, operational financial records, new UI or calculation definition changes.

## Measurement

Actual startup/auth/read queue/full renderer with intercepted synthetic data; Chromium390x844,4 holdings,50ms mock response,no CPU throttle. Old selected request receives300ms additional delay; navigate away while it is running, wait for both responses, then measure return click→matching stock subtotal plus two animation frames. 1W/1M/3M/ALL,5 samples each per scope (20/scope/source). Baseline and candidate run sequentially without a simultaneous benchmark. Raw results: performance/period-return256-{baseline,candidate}.json. Script: experiments/period-return255.mjs. Renderer isn't timing-wrapped. All-account assertion is its stock subtotal; whole-account financial verification remains incomplete.

|Scope|Before median (min–max) ms|After median (min–max) ms|Additional total RPCs per return|
|---|---|---|---|
|stocks|141.8 (111.6–164.7)|81.0 (74.3–85.7)|1→0|
|all, stock subtotal|127.6 (116.3–149.3)|80.5 (59.4–85.1)|1→0|

This improves return navigation after a superseded request completes. It does not accelerate a new uncached period waiting behind an in-flight SQL calculation. Synthetic service delays are not operating DB/network measurements; no production tail-percentile or physical iPhone claim.

## Alternative rejected using new SQL evidence

Serialization originated in beccf177 (Build131) after real statement timeouts and temporary-file rereads, documented in docs/build131-pnl-recovery.md. Keep it. experiments/period-concurrency255.mjs runs the current stock SQL in independent PGlite workers with authenticated account ownership, fixed time,20/100 securities ×30 transactions,40ms 1W→1M→3M→ALL inputs, five alternating scheduling pairs. NAV reconciliation is explicitly stubbed/excluded; separate worker copies do not model shared Postgres storage, locks or connection pools. Response hashes match across workers.

For3,000 transactions, concurrency1→2 changes latest-request median309.2→359.6ms (ranges301.8–324.3 /352.6–363.1), query count2→3, process CPU median446.3→708.5ms. For600 transactions, median97.4→70.7ms but all4 requests run; CPU median240.3→251.5ms. Not uniform benefit, and larger synthetic workload regresses. Do not deploy the earlier parallel counterfactual. Raw performance/period-concurrency255.json; summed per-query elapsed is not CPU, process CPU is separately recorded. No production capacity conclusion or server cancellation claim.

## Validation and handoff

Local deterministic tests: tests/build256_period_cache.mjs checks invisible obsolete completion, original cache timestamp/TTL, auth/day/snapshot rejection, wrong period/today bounds, failure release/retry, data-version invalidation, in-flight return sharing and maximum concurrency1. Existing Build248 supersession/realized order, Build253 queue refill, Build209 refresh and Build210 incomplete/provisional tests passed. Chromium return tests passed in both scopes. CI adds the return test to Chromium and WebKit, alongside existing mobile widths/125%, financial, decision, wealth, chart and startup checks.

Exact-commit CI, Pages promotion and live version verification are pending. Do not report deployed before those complete. Production remains Build255 until a guarded main promotion. Physical iPhone Face ID/keyboard/PWA lifecycle remain untested. The existing work branch is continued; no operational DB access or writes.

Next hypothesis after this bounded cache improvement: distinguish actual slow uncached stock-total versus realized-sales SQL via bounded read-only timings/query plans, preserving request serialization. Inspect duplicate NAV subcalls on all-account period navigation before proposing reuse; don't assume SQL or browser cancellation semantics. Avoid repeating the already-rejected concurrency2 prototype or response-payload-only test without new evidence.

Repeated-use check: Chromium390x844,50 holdings,21 cycles × four periods, post-GC Runtime.getHeapUsage checkpoints at cycles0/10/20. Cache entries stayed4 in both sources. Used JS heap: baseline2,522,844 /2,532,696 /2,573,116 bytes; candidate2,519,996 /2,530,320 /2,573,472. Total requests107/147/187 and stock-total requests4/4/4 match across sources. This single retention sequence detects no additional accumulated stock cache or request growth; it is not a peak-memory or formal leak proof. Other requests continue during period switches, so the initial diagnostic's zero-all-requests assumption was corrected to zero additional stock-total requests before comparison. Inspect realized-details reuse as a next hypothesis rather than claiming all warm-period traffic is eliminated. Raw performance/period-retention256-{baseline,candidate}.json.

Local WebKit launch is blocked by missing GTK/GStreamer system libraries; CI installs these dependencies. Local Chromium seven rapid-switch samples passed; full Chromium/WebKit gates remain required before promotion. No browser timeout was relaxed.
