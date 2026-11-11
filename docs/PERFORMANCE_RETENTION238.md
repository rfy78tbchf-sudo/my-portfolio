# Build238 bounded repeated-detail observation — no app change

Verified main/work branch3527c22122a76b44ab5c715a8a418e3cc7f184e7. Final branchCI40845756040, post-release mainCI40846930914 and Pages40846930282 all succeeded. Live HTML/SW/version.json matched Build238. Continue existing work/performance-detail-render-234; no duplicate branch, production data or product edit.

## Conditions and measurements

Extend the existing `--repeat` diagnostic with `DETAIL_REPEATS=10` (default remains3). Five fresh Chromium sessions, ten same-security detail entries each. Every entry loads fresh detail and saved records, opens a saved history body, scrolls down, returns to portfolio, then explicitly collects garbage and samples CDP DOM counters. Identical365 synthetic prices,10 saved judgments,10 long histories,390x844 mobile/touch viewport,CPU4x,50ms locally fulfilled API responses,SWblocked/routing disables HTTP cache,no network bandwidth throttle. Chromium140.0.7339.186. No real account data or operating writes.

| Metric, median(range),five sessions | Entry1 | Entry5 | Entry10 |
|---|---:|---:|---:|
|Overview ready callback,ms|552(465–644)|391(313–396)|321(299–388)|
|Instrumented render block,ms|251(222–282)|168(124–192)|132(122–175)|
|First history opening callback,ms|49(36–63)|40(35–44)|36(28–52)|
|Requests per entry|8|8|8|
|Post-return documents|2|2|2|
|Post-return DOM nodes|3260|3260|3260|
|Post-return event listeners|145|145|145|

All50 entries had exactly these resource counts and8requests, including one shared history read and fresh saved-decision reads. This is a within-session reuse observation, NOT a before/after optimization. Readiness includes two animation callbacks; it is not presented paint, INP, or actual iPhone/server speed. The result does not establish absence of heap, timer or network-resource leaks: only bounded DOM/listener counters after forced GC were sampled. Ten repetitions do not establish hours-long behavior. No cache/transport byte claims. Raw samples retain long tasks and individual timings.

## Candidate decisions and validation

At most three candidates: (1) detail event/DOM cleanup rewrite — no observed accumulation, not selected; (2) retained detail DOM/data cache — no progressive slowdown or freshness-safe benefit shown, not selected; (3) first-entry prewarming — would move work into startup, prior evidence remains insufficient. Keep existing fresh reads and return behavior. No speculative app change or deployment is justified.

Reproduce: `DETAIL_REPEATS=10 node tests/detail_render_profile234.mjs --repeat`. All50 entries passed request-sharing and bounded-counter assertions; syntax and whitespace checks passed. The parameter adds only an opt-in diagnostic; existing default and six-width/zoom Chromium/WebKit verification modes are unchanged and passed on Build238. New diagnostic commit CI should be checked at next start; no main promotion is intended for this measurement-only record.

Handoff: preserve Build238. Do not keep repeating the same DOM-counter experiment without a new symptom or longer-session hypothesis. Future independent target: measure home trend selection with realistic larger synthetic history and distinguish input/render work from API wait; require a controlled comparison before changing it. Actual iPhone physical touch, native keyboard, Face ID and full PWA termination remain untested.

## Follow-up: diagnostic CI label-counter failure

Run40852265424 failed only the full chart-input step: measured122 label mutations instead of120. Its decision-regression job passed. Product source is identical to deployed Build238; mainCI40846930914 and Pages40846930282 remain successful and actual markers were rechecked. The opt-in repeat-count addition does not execute in --verify chart mode.

The old observer counted all label mutations between animation frames, rather than only the240 intentionally dispatched samples. A deterministic experiment on unchanged Build238 inserts one additional pointer selection between sample groups: the original broad observer reproduces exactly122!==120. This demonstrates a measurement contamination mechanism; the original CI log does not identify the actual extra event and we do not claim its exact origin. Ordinary local Chromium verification also passed unchanged before the test repair.

Repair only the diagnostic: drain/count mutation records synchronously immediately after each four-event group, keep between-group mutations separately as otherTextWrites, and keep the strict120 assertion. No label update is suppressed in the app. CI now injects60 external selections; verifies at least120 external label mutations separately, all60 intended selected indices, accessible/visible label agreement, geometry retention, no requests and mobile return/zoom. Both normal and deliberately contaminated local Chromium six-case verification pass. The broad-observer reproduction failed as expected; the corrected counter passes. This is not new performance evidence and does not revise the earlier controlled timings. Product code, Build238 markers and deployment are unchanged.

Next: check the corrected diagnostic commit's Chromium/WebKit CI before further measurements. No main promotion or redeployment is intended. Then resume the independent home-trend investigation; do not mask assertion failures by loosening counts or rerunning until green.
