# Build255 period response-size follow-up — 2026-11-10 KST

Main42c5f46a448a30d5bba66bf4f7cd578d4d25aa94, existing performance branchdc59523b22ce03088240aa94cfa190c85cb00b43. Read deployment handoff; no new branch/product edits or deployment. Existing successful Pages42654315576 and exact-SHA pre-promotion CI42651039759 remain the release evidence. Public version.json checked this run. No operational financial reads/writes.

## Newly observed CI failure (do not hide as a known flake)

Main-triggered duplicate run42654317839 failed in WebKit at tests/build211_decision_browser.mjs:239: restored pending decision form did not become visible in30s after a new visit with history reads deliberately failing. Synthetic writes/stored counts4/4, no page errors/forbidden calls/dialogs, status element absent. This does not prove a lost save or a renderer regression. Same-SHA pre-release complete suite passed; failure root cause remains unknown.

Requested failed-job rerun through GitHub; attempt2 is in progress. Its previously failing decision-save/reopen step passed (2026-11-09T16:35:14Z–16:35:33Z), and decision-regression job passed. Do not describe the entire rerun as successful until it finishes. Local Chromium decision browser test also passed; local WebKit cannot launch because GTK/GStreamer and related libraries are missing, so use CI evidence. No test weakening, retry loop, timeout increase or production workaround introduced.

## Response payload hypothesis

New experiments/period-payload255.mjs uses actual app startup, auth, request queue and full renderer. It injects synthetic get_live_realized_sales responses with100 or1000 calculated sale rows distributed across4 symbols,4 holdings. All browser requests are locally intercepted. Actual renderer is not wrapped for timing; request tracing remains inherited from the harness. Chromium390x844,50ms mock service delay,no CPU throttle. Three samples for each1W/1M/3M/ALL × stocks/all × application-cache miss/repeat =48 observations per size, plus one rapid switch. “Cold” means period/result caches cleared after startup, not browser-cache-free startup. Rows are returned sale records, not a measurement of database transaction-table size. No real DB/network timing claim.

| Returned rows | Scope | Cache-miss median/min/max ms (12 samples across periods) | Repeat median/min/max ms (12 samples) |
|---|---|---|---|
|100|stocks|164.7 /147.0 /180.9|31.0 /29.7 /31.8|
|100|all|164.8 /148.2 /196.4|31.4 /30.2 /35.2|
|1000|stocks|162.1 /147.0 /181.7|31.3 /19.2 /31.9|
|1000|all|165.1 /148.6 /182.8|31.5 /24.1 /41.6|

Every cache miss issued one selected stock-total RPC; every repeat issued zero. Rapid synchronous1W→1M→3M→ALL reached correct ALL after pending work settled in81.1/83.8ms, issuing one stock-total RPC each. These are single rapid samples, not percentile estimates. Assertions verify correct rendered subtotal, latest period, partial status, returned row count, all-account unverified marker and no forbidden external/mutation calls. Both scopes retain incomplete financial semantics. Three samples per individual period are insufficient for a slow-tail percentile; raw per-period measurements are committed.

Increasing returned sales tenfold did not establish a meaningful end-to-end bottleneck in these conditions. No production optimization or release justified. This is fresh hypothesis evidence, not a Build255 before/after claim. Do not use it to assert that operating-server intermittent delays are solved.

## Next action

First inspect attempt2 of42654317839 without starting duplicate work. If the restoration failure recurs, inspect its failure screenshot and instrument modal/draft state with synthetic data before changing product behavior. Preserve the failure as unresolved even if the rerun passes. For period latency, move from returned-row scaling to controlled delayed-response/out-of-order scenarios with actual user click spacing, cache expiry and owner/day changes; compare request-to-current-paint distributions for at least enough repetitions to detect intermittent stalls. Use independent synthetic database fixtures if evaluating history-table growth; do not conflate returned rows or holding count with DB volume. Avoid another identical100/1000 payload benchmark unless code/conditions change.
