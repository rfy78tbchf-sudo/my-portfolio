# Build235 — Avoid the intermediate full redraw at home refresh completion

Base main716448a (Build234); main CI40690490893 and Pages40690485277 passed and actual deployed markers were rechecked. Continued the existing work/performance-detail-render-234 branch atd18ffeb, whose CI40781346111 passed. No duplicate branch or implementation.

## Problem and change

The startup trace records seven home render calls for both cold and warm entry. In the home-only loader, the homeReads completion callback renders while detailsLoading remains true; loadLiveOnce then clears detailsLoading and the owning refreshLive renders again. These final two renders execute back-to-back with no additional data query between them.

When a refresh promise owns completion, omit only the intermediate render in that homeReads completion callback. The existing refreshLive final render remains, after detailsLoading clears. A standalone loader without a refresh still renders as before. Early assets, core holdings, home review and startup-performance updates remain independently visible. Enrichment, error handling, request ownership checks, input deferral, final freshness labels and financial definitions are unchanged. This is not general frame batching or caching and adds no timer.

## Controlled evidence

Five fresh Chromium sessions per version, each cold visit and warm reload; four synthetic holdings,50ms locally mocked API responses, real local HTTP and SW cache,390x844 touch/mobile,CPU4x, Playwright1.55.1 Chromium1193. Sequential baseline then candidate batches. Trace categories devtools.timeline/blink.user_timing/toplevel plus served-source render marks; includes instrumentation overhead. The candidate source differs only in the conditional intermediate render. Release marker/comment changes do not alter this behavior.

| Metric, median(range) | Before | After |
|---|---:|---:|
| Home renders, cold and warm |7 in every observation|6 in every observation|
| Post-asset layout, cold ms |271.0(209.3–369.4)|168.7(156.4–181.4)|
| Post-asset layout, warm ms |217.5(165.5–256.2)|164.8(149.3–169.9)|
| Cold idle observed, ms |1373(1326–1468)|1124(1084–1390)|
| Warm idle observed, ms |1114(891–1177)|902(852–936)|
| First portfolio callback, cold ms |162(137–199)|146(131–157)|
| First portfolio callback, warm ms |126(77–147)|110(97–126)|

The deterministic change is one fewer whole-home render per entry. Layout timing supports reduced work, particularly cold entry; overlapping end-to-end ranges do not establish a device speed guarantee. Startup reads remain19cold/17warm, first portfolio31, with no new requests. First interaction is after startup-idle/SW-ready observation, not the earliest possible user input. No initial-payload optimization is claimed.

Asset mark follows matching displayed synthetic amount and two rAF callbacks. Warm display may be a cached snapshot preview; it does not certify fresh current-account data. Post-asset layout sums main-renderer Layout events whose start is after that mark. ParseHTML/EvaluateScript are nested/overlapping and must not be added. Trace RunTask entries were not captured under the selected name: absence does not mean zero long tasks; use the existing PerformanceObserver samples. No INP, presented-paint, actual iPhone/server, compressed-wire, heap or timer-retention claim.

## Selection and validation

Candidates considered: (1) redundant refresh-completion render, selected after trace and controlled comparison; (2) broader startup batching, not selected because early data stages are useful; (3) parse/code splitting, not selected from overlapping trace totals alone. Previously rejected SW delay, row containment and early swing scheduling stay rejected.

Local checks passed: startup authority/late failure/account isolation; home-only/full-loader contract and enrichment retry; resume/input/detail/day isolation; retained period/scroll/failure states; Chromium real-SW update/draft/manifest fallback and cached navigation; version consistency. Existing final CI runs Chromium/WebKit and390/402/430px/125% wealth, detail return, chart, decision input/save and refresh regressions. No live DB test writes or real iPhone/Face ID/native keyboard/full-PWA-restart testing.

Release requires final commit CI success, fresh main SHA match716448a, fast-forward only, successful Pages deployment and actual HTML/SW/manifest markers2026-10-29-startup-render-235 / my-portfolio-shell-2026102908-235. Do not report deployed before those checks.

Handoff: finish CI/Pages verification first. Then inspect earliest post-asset interaction under in-flight startup responses if another reproducible delay remains; do not eliminate useful staged displays or weaken stale-data labels. Retain this trace option for targeted attribution, not routine repeated aggregate benchmarks. No further layout/cache rewrite is justified by this change alone.
