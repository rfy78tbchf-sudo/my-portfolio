# Build266 experiment — enrichment navigation and rejected detail priority

2026-11-10 KST. No release/version bump. Fresh main77e23e5577240eef097584f00dc4f1ee2b72552f(Build265), existing work3e252568a8b4263a56abf0ee9759ca4d083c32b3. Pages42752496251 and exact-SHA work CI42749352465 success; duplicate main CI42752497633 still running at both checks, so no duplicate run requested. Public version.json HTTP200 matches265. Working tree initially contained only unrelated supabase/.temp; untouched. No competing work-head change or operating financial queries/writes.

## New hypothesis and method

Continued265's constrained-CPU enrichment-render hypothesis. `experiments/enrichment266.mjs` derives the existing real startup/auth/request-queue/navigation fixture. Fifty synthetic holdings,24 price points/security,390x844 touch/mobile Chromium,50ms intercepted response delay,SW blocked,warmed tabs,no HTTP cache. Five fresh sessions each for CPU1x/4x; within each session alternate idle versus pending-enrichment order. Hold benchmark-comparison response during a full portfolio refresh, navigate home→portfolio→ARM detail, then release enrichment/history and drain. Verify the detail remains visible and chart keyboard Home works after completion. Record two-rAF tab/detail readiness, render spans,long tasks,request counts. This is callback readiness, not actual presented paint/INP; chart input is after drain, not concurrent chart dragging. No actual SQL/broker traffic,financial data or physical iPhone measurement.

|Condition,5 samples|Detail readiness median(range),ms|Home callback median(range),ms|Portfolio callback median(range),ms|Chart after-drain median,ms|
|---|---|---|---|---|
|CPU1x idle|199.0(197.9–215.5)|33.8(31.6–35.6)|32.2(30.8–32.4)|32.4|
|CPU1x pending|798.5(792.4–798.8)|27.1(23.5–34.9)|32.0(31.3–34.2)|32.5|
|CPU4x idle|298.3(230.9–331.3)|58.3(50.0–78.7)|46.2(32.4–64.2)|48.7|
|CPU4x pending|840.5(831.4–857.6)|74.8(64.9–81.1)|36.3(35.0–65.8)|48.5|

Raw performance/enrichment266-cpu{1,4}.json. Pending produces11 render spans versus2 idle; summed CPU4x spans168.8–197.1ms versus45.8–61.2ms. CPU1x has no long tasks; CPU4x idle0–1(max158ms) and pending0–2(max128ms). These windows include detail startup and post-release completion, not only background rendering. Pending navigation/detail readiness stays about0.8s even without CPU throttling, so rendering alone does not explain the gap. Requests7 idle,71–72 pending (the latter includes drained refresh/background work, not71 detail reads). No tail percentile or heap claim.

Candidates considered: (1) prioritize detail reads over queued enrichment; (2) reduce repeated rendering, smaller observed contribution and risks loss of newly arrived data; (3) widen concurrency, rejected in previous work and not repeated. Investigated only(1) in an isolated /tmp HTML, without modifying index.html.

## Candidate and blocking counterexample

`experiments/priority266.mjs` generates candidate via CANDIDATE_OUT: mark get_live_security_detail/activity, get_investment_thesis/decisions as interactive alongside existing P&L reads. Existing queue is boolean priority with unshift. CPU4x five candidate sessions: pending detail258.4(224.0–348.1)ms, idle280.7(244.6–314.4)ms. Requests unchanged7 and71–72; chart median48.5/48.7ms. Raw performance/enrichment266-priority.json. This is a separate sequential candidate block, not alternating baseline/candidate speed trials; enough to identify a promising queue hypothesis, not enough to ship.

Critical scheduler guard uses actual extracted queue/rpc functions,three held active reads,already-queued period P&L,then four detail reads,50ms synthetic replies. Five alternating baseline/candidate pairs. Baseline P&L completes median50.38(range50.34–50.92)ms; candidate101.83(101.67–102.29)ms. Baseline dispatches P&L first; candidate dispatches all four detail reads before it. Raw performance/priority266.json. This is a deterministic scheduling counterexample, not browser/hosted SQL timing. Reject the blanket priority candidate because it demotes the explicitly highest-priority P&L query. No assertion or timeout weakened; no product/UI/financial calculation/cache/collection change, no new CI or redeployment. Build265 remains deployed. Both diagnostic scripts syntax-check and all retained fixture assertions pass.

Reproduce baseline: CPU_RATE=1/4 node experiments/enrichment266.mjs. Candidate: CANDIDATE_OUT=/tmp/candidate266.html node experiments/priority266.mjs, then CPU_RATE=4 UI_SOURCE=/tmp/candidate266.html node experiments/enrichment266.mjs. Every source receives its matching synthetic version manifest. Do not copy the rejected candidate into the app.

## Next action

Test an explicit priority ordering that preserves queued P&L ahead of detail, puts only active foreground detail ahead of ordinary enrichment, and keeps the existing concurrency cap3. Before considering deployment, extend the scheduler guard for already queued P&L, a newly selected period arriving during detail, superseded/closed detail, owner change and repeated navigation; demonstrate no starvation or added first-P&L delay. Then do alternating browser comparisons with first-period correctness/realized interaction as well as detail readiness, both engines and required mobile/zoom CI. Avoid globally elevating background decision/thesis reads based only on RPC name. If those guards cannot be met, retain current behavior. Do not repeat the same render-only hypothesis, reintroduce total-first gating, cache stale realized amounts or remove265/264 freshness guarantees. Production intermittent latency distribution and real iPhone remain unverified.
