# Build236 — Distinguish pending holdings from an empty portfolio

Base main447cb067add33bc678a4b85df84004a987c98d6c / Build235. BranchCI40787124946, mainCI40787884608 and Pages40787884698 all passed; deployed HTML/SW/manifest markers were rechecked. Continued existing work/performance-detail-render-234, without a duplicate branch or overlapping execution.

## Finding and change

While measuring first portfolio interaction, delaying the initial holdings response reproduced this sequence: authoritative quick asset appears → tap 내 종목 → the app says 보유종목 없음 although the holdings request is still pending. Both cold and warm cases reproduced in local Chromium. This is an unknown/pending state, not evidence of an empty account.

Add an initial livePortfolio guard: if no live dataset, no liveError, and a live load/refresh promise is active, show 종목 불러오는 중 and a short pending explanation inside role=status. Existing layout/component styling is reused. Once holdings arrive the ordinary portfolio renderer takes over; a completed empty response still shows 보유종목 없음. Existing data is retained during refresh as before. No numerical calculation, request scheduling, cache freshness, storage or error handler changed. This accuracy fix takes precedence over speculative latency changes.

## Measurements and candidate decisions

Extended the existing isolated real-HTTP/SW fixture with --early-interaction and --early-core (separate from aggregate startup profiling). Five fresh Chromium sessions per version, each cold then warm;390x844 touch/mobile,CPU4x, synthetic four holdings and50ms API responses, local uncompressed HTTP, no bandwidth throttle. The early-interaction test gates startup performance summary after core holdings are available, navigates before startup completion, types ARM, releases the gate and checks final selection/query/focus/visible row and home amount. It is a controlled early-interaction window, not the absolute earliest possible physical tap.

| Metric median(range), ms | Build235 | Build236 |
|---|---:|---:|
| Cold portfolio callback |194.0(145.8–220.8)|171.3(160.7–207.3)|
| Warm portfolio callback |128.1(122.2–171.2)|115.8(113.5–147.0)|
| Cold completion after click |966.7(868.9–1025.0)|913.6(898.9–946.2)|
| Warm completion after click |873.1(820.9–942.1)|825.4(815.3–1082.6)|

Ranges overlap and the changed loading guard is not exercised in that core-ready timing window: **no speed improvement claimed**. Calls remain50cold/48warm through startup plus enrichment in every observation; the startup summary is requested exactly once. Counts include reads preceding the click. Completion includes the deliberate gate/input sequence and cannot be used as actual server latency or refresh duration. Callback uses two rAF callbacks and locator observation, not paint/INP. No byte, long-task, heap or listener/timer change claim from this experiment.

Candidates: (1) extra sharing of the pending summary is unnecessary: already one call; (2) suppressing late renders is not justified: active portfolio/search/focus survive; (3) pending-data wording is demonstrably incorrect and is the selected fix. No layout expansion or feature added.

## Regression and release

--early-core gates holdings before the first portfolio entry, verifies role=status and the pending message (not an empty-account message), releases data, and verifies actual rows/search and focus. In verification mode it checks390/402/430px ×100/125% text fit and navigation touch targets while pending, then tests a completed empty response still shows the ordinary empty state. Both early modes also run existing update notice, draft preservation, missing/malformed manifest fallback and cached-navigation recovery scenarios. Existing broad CI retains detail Back, chart, currency, wealth, decision save and mobile layout coverage.

Local Chromium early-core/early-interaction checks and startup/load contract tests are run before publishing. Final commit CI must pass Chromium/WebKit before promotion. Actual iPhone/Face ID/native keyboard/full PWA restart remain untested. All browser/API data is synthetic; no operating DB writes.

Release markers:2026-10-29-loading-state-236 / my-portfolio-shell-2026102909-236. Recheck main447cb067 before fast-forward; verify Pages and actual markers before reporting deployment. Timing samples are in docs/PERFORMANCE_EARLY236.samples.json.

Handoff: first finish/confirm CI and deployment. The early-interaction window preserves pending-request sharing and input, so do not add speculative deferral. Next independent performance check may cover chart first input while detail data is pending, with cancellation and return-state assertions; keep already measured steady-state chart reuse and prior rejected candidates closed unless new evidence appears. No claim that all performance work is finished.
