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

## Follow-up: timeline attribution and containment experiment (2026-10-28)
Continued the same branch after its CI 40700580614 passed. Main remained 716448a and the live HTML/SW/manifest still matched Build234. No duplicate branch or release was created.

Added optional `--trace` mode, using Chromium CDP timeline events and stack traces. Five diagnostic runs showed a dominant document-root layout with 203 dirty / 391 total layout objects, 119–176ms. Its stack points to the instrumented mid-construction scroll reset. This attributes when layout is forced, not which individual CSS selector is expensive. Trace instrumentation adds overhead; an independent VM refresh diagnostic overlapped these traces, so their times are diagnostic only and must not be compared with the controlled samples.

Candidate 1 was layout isolation: tested only `.detail-sheet{contain:layout}` in a temporary HTML copy via UI_SOURCE, preserving the existing scroll reset. Candidate 2 (remove reset) remains rejected by the prior experiment; candidate 3 (defer closed history bodies) remains deferred for weak end-to-end evidence. No additional product change was made.

Five fresh sessions before and five after, run sequentially without competing local benchmark work, tracing disabled, same fixture/browser/390px/CPU4x/mock delays/cache conditions as above:

| Metric, median (range) | Current Build234 | Temporary layout containment |
|---|---:|---:|
| Overview readiness, ms | 551 (509–879) | 600 (570–678) |
| Synchronous block, ms | 282 (241–455) | 298 (268–344) |
| Layout duration, ms | 260 (236–433) | 276 (269–341) |
| Task duration, ms | 556 (530–905) | 623 (598–700) |
| First history opening, ms | 42 (37–57) | 48 (38–50) |
| Requests | 8 in every run | 8 in every run |
| Layout count | 6 in every run | 6 in every run |

Ranges overlap; no repeatable benefit supports adopting containment. No app source/markers changed and no deployment is needed. Raw samples and diagnostic layout events are in PERFORMANCE_DETAIL_TRACE234.samples.json. The refresh fixture was rerun alone after both browser batches; its raw three samples and medians are included there. It models 40ms ordinary reads, 180ms valuation, 250ms reconciliation; it does not measure actual network/server/iPhone refresh latency or validate the old approximately-five-second claim.

Validation: optional tracing completed five sessions, baseline and candidate completed five each; run `CHROMIUM_ONLY=1 node tests/detail_render_profile234.mjs --verify` for the unchanged mobile/back/scroll/history checks. WebKit app regressions remain covered by the previously successful main and measurement-branch CI; this commit only extends diagnostics. Check its CI result at the next start. No main merge is intended for a measurement-only result.

Next: prioritize cold/warm detail timeline comparison to distinguish one-time browser text/layout setup from repeat-entry cost. Only test a targeted batching strategy if that trace identifies redundant work. Keep the rejected reset removal and generic containment out of product code. Preserve request freshness, saved-decision generation guards and scroll/focus semantics.
