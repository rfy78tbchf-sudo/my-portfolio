# Build240 annual history and home completion experiment

2026-10-30 KST. Latest main5b293a4855c6c2a249f2a0553f90ef67e14ea2b2 includes released Build240 annual wealth. MainCI40973670396 and Pages40973669545 succeeded; actual HTML/SW/version markers are2026-10-29-annual-wealth-240 / my-portfolio-shell-2026102921-240. Existing performance branch1c2e0effb2b8269addade9c56000fbe60619af79 passed CI40922798021. Merge latest main into that existing branch without conflict; preserve annual calculations/SQL and prior diagnostics. No other active workflow or new branch.

## Measurements and candidate selection

Two independent questions, not mixed into one before/after comparison:

1. Newly added annual history scaling: `WEALTH_HISTORY_YEARS=3` and `=10 node tests/build231_wealth_latency.mjs`, five fresh Chromium sessions each. Synthetic3/10past annual rows with12monthly records/year; historical baseline/end amounts both5m, fixed20/30% goals, current5.4m. No real historical values.390x844 mobile/touch,CPU4x,50ms intercepted API delay,SWblocked/HTTPcache disabled by routing,no bandwidth throttle. Actual application startup and tab entry. Ten-year condition represents synthetic accumulated history, not present user history. The legacy wealthPaintMs field means amount present plus two rAF callbacks, not actual paint/INP.
2. Home final-stage attribution: `PACED_GZIP=1 node tests/build232_update_latency.mjs --paced-startup --render-ownership`, five fresh sessions each baseline/candidate, each cold navigation then warm reload. Four synthetic holdings,24 prices/security,eight asset observations,390x844,CPU4x,API50ms,actual local HTTP/SW cache,shared200KiB/s body pacing,80ms response-header delay,gzip. All traffic fulfilled locally; no operating server latency or physical network claim. Instrumentation wraps render, records caller/loading flags, same-content boolean, and synchronous duration including stack capture; serialization happens after the measured interval. Identical instrumentation/conditions before and after, sequential batches. No cross-comparison to uninstrumented older measurements.

| Annual history metric median(range),n=5 |3past years|10past years|
|---|---:|---:|
|Entry callback,ms|288(263–359)|273(239–321)|
|History HTML function,ms|4.3(0.7–6.5)|8.1(6.4–16.1)|
|First annual expand callback,ms|47.9(44.1–64.0)|44.1(34.0–51.5)|
|Dashboard requests,including expansion|1 each|1 each|

All ten annual sessions assert correct year count,goal amount and12monthly rows with expected final month. Candidate1: lazy history body generation, not selected. Small string-generation growth does not produce an observed entry/expand regression; shifting work to first expansion is not justified. No annual history behavior/calculation changed.

Baseline home traces identify the final two render callers as loadStartupHomeData completion and refreshLive completion, with homeReviewLoading=false. detailsLoading changes between them and serialized HTML equality is false in all ten pairs. Do not call them identical DOM or remove the final cleanup render based on proximity.

Candidate2: test an explicit completion-render ownership parameter passed only from refreshLive through loadLive/loadLiveOnce/loadLiveDetails into loadStartupHomeData. Suppress the intermediate startup render only for home-only owned loads, still on home, with review data already resolved. Keep final refresh renderer and all early/review-pending/full-load/tab-switched/unowned/TTL-retry rendering. The rejected exact patch is PERFORMANCE_COMPLETION240.rejected.patch, relative to Build240 main. Apply only to a temporary comparison source with UI_SOURCE, never production. No changed request order/cache/data/financial definitions.

| Home metric median(range),n=5/cache/version |Baseline cold|Candidate cold|Baseline warm|Candidate warm|
|---|---:|---:|---:|---:|
|Render count|6 each|5 each|6 each|5 each|
|Render duration sum,ms|404.5(375.3–411.4)|410.6(351.8–448.8)|227.1(216.8–258.8)|218.1(192.9–239.8)|
|Asset callback,ms|1492.5(1479.5–1498.1)|1529.9(1488.2–1543.2)|1102.1(1095.4–1185.0)|1120.7(1080.3–1143.5)|
|Startup idle observed,ms|3445.1(3425.8–3462.4)|3443.1(3409.8–3486.5)|2878.9(2861.5–2960.1)|2885.5(2805.4–2910.7)|
|First portfolio callback,ms|128.6(112.2–152.2)|135.4(124.1–171.1)|85.8(70.8–111.0)|109.4(90.1–135.0)|
|Observed long tasks|7(6–7)|8(6–8)|3(3–4)|4(3–4)|
|Startup API reads|19 each|19 each|17 each|17 each|

First portfolio still31reads in every sample. Raw timings/responses/flags are in PERFORMANCE_COMPLETION240.samples.json. The paced harness's legacy prose says no compression; explicit pacing.gzip=true metadata describes these runs. Response body bytes are not wire/TLS transfer bytes. No heap/timer data collected in these experiments.

Candidate2 is rejected: one fewer render does not yield a consistent time reduction, and first interaction/long-task observations do not support an improvement. A targeted temporary VM check passed explicit-owner final rendering, standalone/full caller rendering, delayed review, tab switch, same-period error retention and TTL retry; correctness alone does not justify shipping. The candidate is not in index.html,SW,version or deployment. No third candidate is necessary from this evidence.

## Validation and handoff

Persist opt-in diagnostic modes and raw evidence only. The normal source remains byte-identical to main Build240. Existing CI retains annual history/scenario/mobile390/402/430px×100/125%,chart/back,decision/storage and freshness regressions; its startup step also exercises ownership instrumentation and wealth step uses10synthetic years. Local Chromium update/manifest/fallback/draft/cached-navigation regression is run with ownership instrumentation. Final diagnostic CI must be checked; no main promotion or Pages deployment is intended.

Next: finish this diagnostic commit's CI first. Do not repeat these rejected history deferral or home completion batching experiments without new evidence. Build240 includes approved annual functionality and must remain intact. New optimization needs a measured user-visible bottleneck beyond these overlapping timings; physical iPhone Face ID/native keyboard/PWA restart/real broker delays remain unmeasured. Preserve current deployment if no such evidence is available.
