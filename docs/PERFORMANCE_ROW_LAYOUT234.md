# Build234 portfolio row layout experiment — 2026-10-29 KST

Continued existing `work/performance-detail-render-234` at `1df5df49e046c0a32925aaf2813f2f80b934f811`; its CI40768282679 passed. Main remains716448a, with CI40690490893 and Pages40690485277 successful. Actual HTML, service worker and version manifest still identify Build234. No concurrent implementation was found. This work changes only measurement/verification files; no new app version or deployment.

## Candidates and decision

1. Offscreen rows: test-only CSS `.portfolio-list .portfolio-row{content-visibility:auto;contain-intrinsic-block-size:auto 100px}`. Search, keyboard entry and detail return passed in Chromium, but the estimated size changed the document height during scrolling. At100% zoom the initial6115px document became5486px at the last row (baseline5154px throughout). At125%,8734px became8968px (baseline9475px throughout). Same pattern at390/402/430px. These are measured document-height changes, **not** a measured CLS score or evidence that the tested detail return lost position. Rejected before speed benchmarking: this heuristic does not preserve exact list geometry. A fixture-tuned estimate would not establish correctness for different names, amounts, missing/stale quotes or zoom.
2. Row layout/style containment without a size estimate: test-only `.portfolio-list .portfolio-row{contain:layout style}`. Exact row boxes, document heights, selected-row position and return focus match baseline in all six Chromium width/zoom cases. Five-session timing comparison below shows no clear gain; rejected.

No production CSS/JS, calculations, data freshness, requests or stored records changed. No third speculative candidate added. Do not retry either CSS snippet without new evidence.

## Conditions and results

Both timing versions: five fresh Chromium sessions each, Playwright1.55.1 Chromium1193,390x844 mobile/touch, CPU4x, locally mocked50ms API delays,50 synthetic holdings,24 prices per security, SW blocked, warmed tabs. Same fixture and test sequence, baseline batch then containment batch, run sequentially without concurrent browser benchmarks. Network routing means these are synthetic response delays, not real server/network measurements. Data and font setup are unchanged between variants. Two-rAF callback latency is not presented paint/INP or an iPhone measurement. Instrumentation/CDP overhead applies equally; phases overlap and cannot be summed.

| Portfolio transition metric | Baseline median (range) | Row containment median (range) |
|---|---:|---:|
| Idle callback, ms | 364 (320–443) | 364 (339–427) |
| Idle CDP layout, ms | 257.8 (223.8–330.3) | 261.9 (232.1–328.2) |
| Refresh-pending callback, ms | 390 (332–425) | 413 (374–444) |
| Refresh-pending CDP layout, ms | 290.3 (212.9–334.9) | 319.7 (286.5–326.6) |
| Long tasks, all four idle tab clicks | 4 (4–4) | 4 (3–4) |
| Long tasks, all four pending tab clicks | 4 (4–4) | 4 (3–4) |
| Reads during refresh/navigation sequence | 96 (96–96) | 96 (96–96) |

All ten timing sessions kept exactly one sync-current despite a repeated refresh click, retained the search input/focus while the holdings response was pending, and displayed the changed synthetic total. Read counts are for this50-holding interaction sequence, not isolated refresh or first load. No downloaded-byte, heap, timer-retention or whole-app leak claim: this experiment does not collect them. No causal slowdown claim from overlapping timing ranges either; the decision is lack of demonstrated benefit.

## Geometry regression

New reusable `tests/portfolio_row_geometry234.mjs`, enabled with `--row-geometry` in the existing isolated refresh fixture, checks six width/zoom combinations:390/402/430px ×100/125%. It enters the last initially offscreen row via keyboard, returns through browser Back at402px and the in-app return button otherwise, searches that symbol, enters/returns again and checks the query. Checks include amount/P&L fit,44px row touch height, row above bottom navigation, document width, retained scroll/row position and focus. A height-invariance assertion now rejects the estimated-height candidate. All raw geometry in the experiment record was captured before adding that final assertion; the final baseline run uses all assertions.

Baseline last-row height88.875px at100%,172px at125%; document heights5154/9475px respectively. Existing container queries change row layout at zoom; a fixed-height assumption is invalid even for this small variety of synthetic content. Geometry tests are separate from timed sessions; their forced geometry reads and prior scrolling must not be included in performance comparisons.

Local final Chromium verification: run `CHROMIUM_ONLY=1 SYNTHETIC_HOLDINGS=50 node tests/refresh_interaction_profile234.mjs --verify --row-geometry`. CI adds the flag to the existing50-holding Chromium/WebKit step; no duplicate workflow or branch. Local WebKit still requires unavailable OS dependencies and is delegated to the existing CI job. No real iPhone, native keyboard, Face ID or complete PWA restart was performed.

## Handoff

Check this diagnostic commit's CI; keep main and Build234 unchanged. No product promotion is intended. Both row-layout candidates are closed without evidence for a safe improvement, rather than left as implementation tasks. If a future exact-geometry/cache approach is proposed, it needs width/font/data invalidation and offscreen search/keyboard/return coverage before adoption; do not infer that preserving a fixed fixture proves arbitrary financial content safe.

Next independent priority is the current cold/warm startup and reconnection path: reuse the established Build232 SW/update fixture on current main, distinguish content-ready and first-interaction timings, and inspect unnecessary preload/response payload only where measured. Do not repeatedly rerun unchanged small-fixture layout microbenchmarks or claim all performance work complete. Preserve the existing on-demand Excel loading, manifest fallback, quote timestamps and stale-data rules. If no new reproducible bottleneck is found, make no app change and suppress routine notifications.
