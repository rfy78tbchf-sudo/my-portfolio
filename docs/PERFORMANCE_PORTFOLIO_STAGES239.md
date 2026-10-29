# Build239 first portfolio entry stage attribution

Starting state: main11998325e4b7cdaaf8dd72c393d00d2c48e43e7d / Build239; existing work9c740eb362abee583740aa5118443e1628d6af3c. Its diagnostic CI40873303875 passed. MainCI40865599440 and Pages40865598206 passed; actual HTML/SW/version.json markers matched. Continue existing branch; no duplicate branch, product change or deployment.

## Method

Extend the existing local HTTP startup harness with --portfolio-stages, used together with --paced-startup and PACED_GZIP=1. Five fresh Chromium140.0.7339.186 sessions, each cold navigation and warm reload. Identical four synthetic holdings,24 prices/security,eight asset observations,390x844 mobile/touch,CPU4x,API50ms,shared200KiB/s body pacing and80ms per-response header delay,gzip,actual SW caching. Same scope/limitations as PERFORMANCE_NETWORK239.md: local software pacing is not a physical network or actual server-speed model. Every response including SW requests is served locally; no production financial records or writes.

At first portfolio click, MutationObserver records when all four portfolio rows exist. Two rAF callbacks retain the prior first-tab metric. A separate rAF poll records when all four swingPrices entries exist in the app data map. This last timestamp is internal data readiness, NOT proof that all price/risk labels have painted. All-idle retains existing request-queue/load conditions. Each read records request arrival and full response completion in the Node clock. Node intervals and browser intervals have separate origins; do not subtract across them.

## Observations

| Metric median(range),n=5 per cache condition | Cold navigation then first portfolio | Warm reload then first portfolio |
|---|---:|---:|
|Four-row DOM observation,ms|28.3(24.5–60.8)|22.0(14.3–32.3)|
|First-tab two-rAF callback,ms|144.0(130.8–211.3)|125.3(101.6–139.8)|
|Four swing data entries ready,ms|2865.4(2851.1–3034.0)|2895.5(2856.7–3015.3)|
|All-read-idle observed,ms|2870.4(2855.8–3042.1)|2899.9(2861.4–3027.2)|
|Reads|31 each|31 each|

All ten samples pass: four rows appear, four swing data entries are observed, every read has finite start/completion times. One representative cold sample has first server reads arriving150–191ms after the Node recording origin; last four price reads arrive2407,2426,2631,2650ms and complete2547,2566,2770,2790ms. These are individual representative intervals, not medians. Full samples preserve all request paths/timings and initial asset observations.

The 2.9-second all-idle value is not 2.9 seconds of an empty portfolio. Core rows appear much earlier. Conversely row presence does not prove every supplementary number is ready: the late internal price-data stage is explicitly separate. The test does not establish physical touch/paint/INP, actual iPhone speed, operating server capacity, heap/timer behavior or a performance improvement. No before/after app comparison was made.

## Decisions and validation

Candidates, maximum three:
1. Raise the shared read limit — not selected; artificial local response time does not establish safe production throughput/rate limits.
2. Start swing reads earlier — do not repeat the already rejected request-order experiment in PERFORMANCE_TABS234.md without new evidence. The timeline confirms late data but does not demonstrate a safe improvement over that prior controlled result.
3. Remove offscreen enrichment reads — not selected; first list is already present, and separating shared enrichment requires request ownership/freshness and later-tab regression evidence. Do not remove authoritative reads just to lower all-idle.

Reproduce: `PACED_GZIP=1 node tests/build232_update_latency.mjs --paced-startup --portfolio-stages`. Flags are opt-in; standard modes do not create these stage observers or request timing records. Syntax/whitespace checks pass. Local standard Chromium --verify retains update/fallback/cache/draft checks; prior app and previous diagnostic Chromium/WebKit CI passed. New diagnostic commit CI is the next continuation check. Product source, version markers and main remain Build239, so no main promotion/deployment is intended.

Handoff: do not repeat these same first-entry timings without a targeted change/hypothesis. Before changing enrichment scheduling, establish which supplementary information must be visible and verify failure/retry/late-response ownership. Alternatively trace initial parse/execute attribution before proposing code splitting. Keep existing freshness and calculations. Native iPhone keyboard/Face ID/PWA termination remains untested.
