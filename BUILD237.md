# Build237 — Remove redundant post-background home redraw

Base main decd65c9bfc048ea736d7265db41600b71befe9c / Build236. Existing work/performance-detail-render-234 at9fe11ed49a54a8f6ee101297a7a3c81af0f46777 had CI40821124891 success; mainCI40797736354 and Pages40797735740 passed. Live HTML/SW/manifest Build236 markers rechecked. Reuse this branch; no duplicate work.

## Evidence and selected change

Extend existing --complete-refresh --profile-render instrumentation to record render state, consecutive HTML equality, and phase durations. Five fresh Chromium sessions per version, each one background-due and one TTL-fresh refresh. In every baseline background-due sample, the last home render produced exactly the same content HTML as its predecessor; detailsLoading changed true→false but is not used by UI rendering. loadLive already renders fresh home data, enriched views or errors; completeBackgroundSync's extra `.then(...render(true))` repeats the completed home display.

Remove only that outer redraw. Retain the complete loadLive call, history/price synchronization, TTLs, request ordering, active owner guard, error/status handling and all loading-stage renders. No calculation, record, currency, layout or storage definitions change. A concurrent foreground refresh retains its own final renderer; standalone loads retain theirs. This does not defer data presentation to the next user interaction.

Candidates (maximum three): (1) final identical post-background render — selected; (2) other identical intermediate renders — not selected, since independent loading/error transitions need separate evidence; (3) removing data reads — not selected, they cross a real refreshed-data boundary and are necessary for freshness.

## Controlled before/after

Same synthetic four holdings/24prices per security, warmed tabs/home,390x844 mobile/touch,Chromium140.0.7339.186,CPU4x,50ms locally fulfilled API calls including sync, no bandwidth throttle. Service workers blocked and routing disables HTTP cache. No operating DB writes. The local browser cache had been removed; the exact same Playwright browser build1193 was restored before BOTH datasets. Earlier runs are not used as the comparison.

| Metric, n=5 per condition | Build236 | Build237 candidate |
|---|---:|---:|
| Background-due home render count |11 every run|10 every run|
| Sum of instrumented render phases, ms median(range)|559.2(502.5–629.9)|498.3(458.5–567.4)|
| Background-due all-idle callback, ms median(range)|1586.3(1518.9–1705.3)|1551.2(1453.2–1608.1)|
| Background-due asset DOM update, ms median(range)|181.2(167.2–196.5)|187.1(176.5–215.7)|
| TTL-fresh render count |5 every run|5 every run|
| TTL-fresh all-idle callback, ms median(range)|709.9(688.5–803.6)|715.9(712.0–759.3)|

Structural removal of one identical full render is reproducible. Total-time ranges overlap; no end-to-end speed or iPhone speed guarantee. Render-phase sums are instrumented synchronous elapsed intervals, not isolated CPU, painted frames or INP; HTML equality serialization happens outside the summed intervals and instrumentation overhead exists in both datasets. Background-due requests remain37/33731decoded JSON bytes; TTL-fresh18/16860 in every run. Payload bytes are not compressed wire transfer. Raw long-task observations are retained; no zero-long-task, heap or event/timer retention claim.

## Regression and release gate

The complete-refresh verification fixture changes the synthetic current asset by an additional1 only when background price sync completes, then asserts the rendered amount equals that final server fixture. This ensures removing the outer renderer cannot leave the pre-background amount on screen. Six390/402/430px ×100/125% cases, duplicate clicks, final button state, amount fit and request accounting remain covered. Existing CI retains pending input/search/focus, failure/retry, detail/chart navigation, currency, saved-judgment and wealth scenarios in Chromium/WebKit.

Local Build142 background dedup/TTL/failure retry and Build216 load/standalone/lazy/error/owner contracts passed. Local Chromium complete-refresh verification passed all six width/zoom cases, including the changed post-background amount. Final commit CI must pass before main promotion; recheck latest main SHA and fast-forward without conflicts. Verify Pages and live index/SW/version.json before reporting deployment.

Markers:2026-10-29-background-render-237 / my-portfolio-shell-2026102915-237. No actual iPhone Face ID/native keyboard/PWA termination test. Synthetic server acknowledgements do not establish actual KB speed or resolve the historical approximately5-second report.

Handoff: finish final CI/main/Pages/live-marker verification first. Do not remove remaining stage renders merely because a deterministic fixture sometimes repeats HTML. Next performance investigation should target independently measured interaction delays or real render traces; retain all authoritative data freshness boundaries and avoid repeating rejected layout/request-order candidates.
