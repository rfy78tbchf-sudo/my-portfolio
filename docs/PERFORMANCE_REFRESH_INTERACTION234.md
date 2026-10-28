# Build234 refresh interaction baseline — 2026-10-29 KST

Continued existing work/performance-detail-render-234 at fef811e, whose CI40734262961 passed both browsers. Latest main remains716448a / Build234, and live HTML, SW and version manifest match. No overlapping implementation branch/running CI was found. Product code and deployment remain unchanged.

## Conditions
Five fresh Chromium sessions, warmed portfolio/performance/wealth caches,390x844 mobile/touch, CPU4x, synthetic50ms reads, SW blocked. In each session measure portfolio→home→wealth→home while idle, then start the actual refresh button and hold its holdings response behind an explicit gate; measure the same tab clicks before releasing the response. Input ARM into the synthetic portfolio search while refresh is pending, release the gate, then verify input/focus preservation and the newly supplied synthetic total after returning home. All API requests are intercepted locally; no real financial records or writes.

This is a baseline between two states of the SAME app, not an optimization before/after. Timing is programmatic click through two animation callbacks, not presented paint, real touch INP or actual iPhone speed. Cache warming and fixed order can influence the samples. The gate stays closed until interactions finish; this is controlled pending I/O, not an estimate of actual server delay or total refresh time. Background history sync remains separately gated as in the established fixture.

| Action | Idle median(range) ms | Refresh pending median(range) ms |
|---|---:|---:|
| Portfolio | 83 (66–112) | 84 (75–101) |
| Home | 91 (71–110) | 75 (73–124) |
| Wealth | 91 (74–103) | 60 (59–75) |
| Home again | 91 (69–115) | 88 (75–128) |

Long tasks observed during each four-click window: idle counts3,2,3,2,3 (durations53–83ms); pending counts3,2,3,2,3 (51–105ms). These show remaining main-thread work even though navigation succeeds. Short windows and observer delivery are bounded observations, not a whole-session no-jank claim. WebKit lacks longtask support and reports null rather than fabricated zeros.

Five runs each made exactly one sync-current request despite a repeat refresh click. Total50 requests includes sync and data/enrichment caused by the scripted navigation and post-gate completion; do not compare it to the17-read isolated load fixture as a regression or call it duplicate traffic. The old cached view stays usable while the response is pending. Search value and focus survive completion; home shows the synthetic updated total afterward. Raw samples retain request names/counts.

## Candidate decisions
1. Blocking network wait: no repeatable additional navigation delay attributable to the held response was demonstrated. No loading/queue rewrite selected.
2. Duplicate refresh: existing busy-state behavior prevents a second sync in all runs. No additional request-sharing layer selected.
3. Synchronous tab rendering: long tasks remain both idle and pending. This is the next candidate for targeted CPU attribution. Do not add DOM caching or defer financial displays based only on the aggregate counts; retained search, sort, period, wealth state and stale-data behavior must stay correct.

## Validation and handoff
`node tests/refresh_interaction_profile234.mjs` runs5 fresh Chromium samples. `--verify` runs one session per Chromium/WebKit; locally CHROMIUM_ONLY=1 avoids missing WebKit OS dependencies. Local Chromium passes duplicate-sync, tab selection, search/focus and final updated-total assertions. CI now includes both browsers for this diagnostic; check final commit result next. Previous main/branch CI is green; this is not a deployment candidate.

Next: attribute the50–105ms tab-switch tasks using CPU/timeline data around render(), and compare the relative cost of DOM construction, formatting and layout. Only then consider a narrowly scoped change, measured against the same warm-cache interaction sequence and first-use/refresh regressions. Do not rerun the rejected blanket-enrichment deferral, early-swing scheduling, scroll-reset removal or generic layout containment without new evidence.
