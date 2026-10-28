# Build234 tab-render attribution — 2026-10-29 KST

Main716448a remains Build234. Previous diagnostic commit37a629c passed CI40742695910; live HTML/SW/version.json markers match. Continued existing work/performance-detail-render-234 without overlapping work or product edits.

Added optional --profile-render to refresh_interaction_profile234.mjs. It instruments only the locally fulfilled test HTML: render checkpoints split HTML assignment, auxiliary rendering/restoration, deferred loader, nav, page/wealth/other bindings, period visibility, trend anchor and scroll. Chromium CDP Performance metrics surround each programmatic click through two rAF callbacks. Default test mode/product files have no instrumentation.

Five fresh Chromium sessions, warmed tab caches,390x844 CPU4x, synthetic50ms API responses, SW blocked; same four-tab sequence idle and with refresh holdings response gated. Forty tab samples total, with home twice per sequence. This is attribution on the unchanged app, not before/after improvement. Metrics overlap: the synchronous checkpoint includes forced layout, so do not sum it with CDP layout duration. CDP timings cover a somewhat larger protocol-bracketed interval. Observer, instrumentation and protocol overhead can affect values; not real iPhone/INP/presented-paint results.

Median(range), ms except count:

| Phase/tab | Samples | HTML construction+assignment | Period visibility checkpoint | CDP layout duration | CDP layout count |
|---|---:|---:|---:|---:|---:|
| idle/portfolio | 5 | 14.7 (7.8–20.9) | 0.0 (0.0–0.1) | 36.2 (30.7–55.1) | 1.0 (1.0–1.0) |
| idle/home | 10 | 16.3 (12.4–22.2) | 27.7 (23.6–40.8) | 22.7 (18.8–36.6) | 1.0 (1.0–1.0) |
| idle/analysis | 5 | 13.3 (10.4–14.9) | 0.0 (0.0–0.0) | 21.6 (19.7–23.5) | 1.0 (1.0–1.0) |
| pending/portfolio | 5 | 10.3 (8.0–12.5) | 0.0 (0.0–0.0) | 37.6 (29.9–48.1) | 1.0 (1.0–1.0) |
| pending/home | 10 | 18.0 (14.8–27.2) | 33.1 (23.0–54.6) | 28.1 (18.1–44.7) | 1.0 (1.0–1.0) |
| pending/analysis | 5 | 12.2 (9.7–14.9) | 0.0 (0.0–0.1) | 23.6 (16.8–27.0) | 1.0 (1.0–1.0) |

All home render records have one period-button group; portfolio/wealth have zero. Event binding and navigation construction are small in this fixture (typically sub-ms to a few ms per checkpoint). The synchronous HTML phase cannot separate JavaScript string formatting from DOM parse/assignment. The larger task duration also contains browser work outside these checkpoints. Raw samples preserve all phases, CDP metrics and long-task observations.

## Candidate decisions
1. Batch period visibility reads/writes: no multiple-group layout-thrashing mechanism was demonstrated here; one group and median one layout. Do not remove active-period visibility or move the cost to a later frame and claim a gain.
2. Cache HTML/formatted financial values: no dominant standalone formatter was identified, and data/period/freshness invalidation must be preserved. No speculative cache selected.
3. DOM reuse across tabs: substantial layout remains but no narrowly scoped invalidation-safe change follows from these aggregates. Avoid a broad renderer rewrite with uncertain first-use/refresh benefit.

Local instrumented five-session assertions passed; default Chromium verification retains pending-refresh navigation, duplicate-sync prevention, search/focus preservation and final updated total. Current app is unchanged; previous full Chromium/WebKit CI passed. The diagnostic commit CI should be checked next; no main promotion or deployment is intended.

Handoff: the small fixture no longer supports further micro-optimization claims. Next use controlled synthetic workload scaling (e.g.4/20/50 holdings with explicitly generated names/ids) to identify a concrete superlinear computation or DOM cost, measuring the same first/cached/refresh interactions and retained counts. Do not imply those counts describe the user's portfolio. If no repeatable actionable scaling issue appears, leave product code alone and avoid recycling rejected candidates. Preserve all accounting definitions and UI state.
