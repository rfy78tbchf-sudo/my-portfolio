# Build234 detail-render measurement — no app release

## Starting state and scope
Latest main 716448a0991c88f0704641df504201f225bb69c5 (Build234). Main CI 40690490893, branch CI 40689655975 and Pages 40690485277 succeeded. No overlapping work branch or running CI was found. Live HTML, SW and version manifest were checked separately. This is a completed measurement-only continuation on `work/performance-detail-render-234`, not Build235 and not an unfinished product change. App source and release markers remain exactly main.

## Candidates (at most three)
1. Closed analysis-body construction: ten long synthetic histories produce 620 descendant elements. Five visible-open baseline runs: history callback median 27ms (22–27), first opening through two animation callbacks 45ms (29–65). Subsequent repeated profile runs varied down to 17ms. Deferring these small bodies is not selected: it cannot explain most entry cost, and would add work to first opening.
2. Mid-construction scroll reset: fine-grained marks isolated 134–195ms (median151) inside `updateDetailStart` plus the three scroll resets, versus roughly 0–2ms for each surrounding DOM rearrangement. Tested removal of only the second reset (initial opening reset retained). Rejected after whole-entry measurements below. A shorter synchronous block alone is not a performance win.
3. Initial/late decision rendering: initial block 30–38ms in the fine-grained run. Late reread protects current saved decisions and save generations; do not remove it or cache stale data without measuring an equivalent safe rendering path.

## Controlled before/experiment comparison
Five fresh Chromium sessions each; 390x844, mobile/touch, CPU 4x, mocked 50ms API responses, SW blocked and a fresh context (no browser cache), 365 daily prices, ten saved decisions and ten long synthetic AI responses. No real financial data or production writes. Versions differed only by removal of the second scroll reset. Runs were sequential, not concurrent. Same test and fixture. Raw samples are in PERFORMANCE_DETAIL_RENDER234.samples.json.

| Metric, median (range) | Build234 baseline | Rejected reset removal |
|---|---:|---:|
| Overview readiness, ms | 500 (462–525) | 650 (605–782) |
| Instrumented synchronous block, ms | 245 (205–251) | 98 (90–139) |
| CDP layout duration, ms | 210 (181–259) | 315 (222–414) |
| CDP task duration, ms | 499 (465–527) | 601 (520–818) |
| Layout count | 6 (6–6) | 5 (5–5) |
| Long tasks observed | 1 (1–1) | 2 (2–4) |
| First history opening, ms | 41 (37–50) | 43 (40–66) |
| Requests | 8 (8–8) | 8 (8–8) |

The reset removal shifts work outside the measured synchronous handler and does not improve end-to-end readiness. Layout count falls but total layout work does not. Reverted the experimental app edit; no release or main promotion is warranted. These finite sequential samples are evidence against adopting this candidate, not a claim of universal device behavior. Timing may vary across process runs.

Readiness starts at programmatic portfolio-item click, ends after overview existence and two rAF callbacks; it is not presented-paint time or INP. CPU metrics and long tasks cover click through idle/history-list readiness before the first history opening. History opening first reveals ancestor accordions, waits two callbacks, then opens one record and waits two callbacks; these are callback observations, not real touch latency. CDP metrics are Chromium-only; WebKit verification does not report unsupported metrics. No wire-byte, heap-total, timer-leak, actual iPhone, Face ID, native-keyboard or full PWA restart claims.

## Validation and handoff
`node tests/detail_render_profile234.mjs` reproduces five samples. `UI_SOURCE=/path/to/index.html` supports an alternate source without modifying the app. `--verify` checks Chromium/WebKit at 390/402/430px and 100%/125%, repeated entry after scrolling, top position, overview amount fitting, horizontal overflow, detail return and browser Back, complete history text and fresh reopen; it also retains Build234 request-sharing checks. Locally use CHROMIUM_ONLY=1; CI installs both engines. The workflow includes this verification. Existing app code is unchanged, so this measurement branch is not a deployment candidate.

Next: use a Chromium timeline trace to attribute the first layout's cost, then compare a layout batching strategy with whole-entry task/layout metrics and cold/warm/repeated entry. Do not equate fewer forced layouts or lower handler duration with a speedup. Keep initial scroll positioning and review-entry focus intact. Measure ordinary refresh again when evaluating any data-path change; the prior synthetic refresh was not live server latency. Keep Build234 live until a new candidate shows a repeatable benefit.
