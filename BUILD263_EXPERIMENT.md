# Build263 experiment — embedded-history contracts and reconnect attribution

2026-11-10 KST. Experiment identifier only: **no Build263 product release**. Product files and live Build261 unchanged.

## Fresh state

Main `71386cb45109e2232d2f7a298c2a7fb7d5c2a79d`, work parent `c449408d0d1fb6a065f25249823c0442b60a57dd`. Main CI42725117578, exact-source branch CI42722843360 and Pages42725117323 all completed successfully. Live version.json HTTP200 returned `2026-11-10-sale-quantity-format-261`. No newer workflow or work-head change was present. Existing automation remains enabled; no new schedule/branch. Latest recorded automation run started01:09:34Z; its in-progress flag alone was not treated as proof of another worker. Local product files match the existing release.

Followed BUILD262_EXPERIMENT's next hypotheses, rather than repeating its rejected total-first benchmark. No operating database reads/writes, broker calls, production UI financial data, or external financial search. All fixtures are synthetic and intercepted locally.

## 1. Embedded-history candidate: additional contract gates

`node experiments/swing-contract263.mjs` extracts the existing undeployed swing254 candidate, without importing/rerunning its timing loop. Actual current individual loader is the reference. Fifty securities,0/43/200 input rows, mixed currencies, duplicate and zero-quantity holdings. Assert160-row per-security limit, ascending output chronology, bounded concurrency3, exactly one completion alert/render, and no publication into a replacement live object.

Eight cases: normal, child authorization denial, missing parent through authorization, parent response cap, unexpected parent, individual failure after grouped failure, owner change, and silent nested-history truncation. First seven produce byte-equivalent outputs. Normal50→5 requests; missing/unexpected parents or failed group recover with53 requests versus50. Owner-change case cannot publish alerts/render or alter the replacement object.

New counterexample: when all parent objects remain valid but child histories are silently capped at100 instead of160, the candidate accepts shorter histories for48 securities. This is **synthetic contract fault injection**, not evidence that hosted PostgREST actually applies such a cap. Actual authenticated parent/child RLS and hosted nested-response completeness remain unverified. Short legitimate history and truncated history cannot be distinguished from the current response shape. No further normal-case benchmark or deployment is justified. Keep this prototype rejected unless the API contract is independently established; do not add speculative fallback reads that erase the request gain. Raw `performance/swing-contract263.json`.

## 2. Reconnect with current SQL

`SECURITIES=1 TRANSACTIONS=3000 PAIRS=3 node experiments/reconnect263.mjs` reuses the current262 browser/SQL fixture. Actual stock260 and realized259 SQL in local PGlite; fixed SQL date2026-11-09; NAV and other API results stubbed. One security/3000 trades and four unrelated UI holdings; Chromium140/Playwright1.55.1,390×844,touch,unthrottled CPU,50ms synthetic API transport including auth refresh. Warm SQL plans and visited/authenticated app; service workers blocked. This is neither production server timing nor physical iPhone/PWA restart evidence.

36 samples: four periods×three repetitions×warm data / expired data / expired auth plus data. Three simultaneous calls to the actual resume handler in each sample must share the same promise. Warm samples use1-second-old last-load time; expired use240seconds. Expired auth returns a fresh synthetic token, not a real login.

All12 warm samples:0 API requests,0 period requests,0 renders; same result object retained. No new result was painted or asserted to be newly fetched. Expired samples each replace the stock result object, issue exactly2 period RPCs and52 data requests, and match complete expected stock and realized JSON. The12 expired-auth samples additionally issue exactly1 auth request. No duplicate calculation from the three simultaneous return calls. Correct-paint observer requires a new result object, correct period/date and amount or explicit unknown marker, then two animation frames. Warm cases create no pending observer. Raw `performance/reconnect263.json`.

|Period|Expired data: resume→correct paint median(range),ms|Expired auth+data: median(range),ms|
|---|---|---|
|1W|628.3(625.3–637.9)|664.3(660.7–681.7)|
|1M|616.6(601.5–624.3)|662.3(652.2–666.0)|
|3M|614.2(605.2–648.3)|657.5(649.1–686.6)|
|ALL|854.8(825.4–886.3)|937.4(912.2–955.0)|

Three samples per cell, no tail-percentile inference. These are baseline conditions, **not before/after improvement numbers**. Raw local SQL durations are nested within end-to-end timings and must not be added to them. Warm return timings near timer resolution are not a measured rendering speedup. Assertions also preserve unknown labels and viewport overflow checks at390/402/430px and CSS125%. `tests/build195_resume_retry.mjs` passes failed-lane retry, healthy fast path, coalescing, owner and hidden-page guards. Syntax checks pass for both new experiment scripts. No shipping code changed, so no new deployment/CI or WebKit equivalence is claimed.

## Outcome and next action

No justified product change: individual swing reads retain established behavior, and current reconnect already coalesces events and avoids fresh reads inside TTL. No version bump or redeployment. Do not repeat these same normal/failure benchmarks or reintroduce total-first scheduling, unverified realized amount caching, or increased calculation concurrency.

Next independent refresh hypothesis: user-triggered refresh includes `refreshLive(true,true)` and `completeBackgroundSync(true,requestedAt)`, whereas the current262 and reconnect263 timings intentionally exclude foreground broker sync. Instrument that orchestration with intercepted synthetic edge responses, retaining sequential broker work. Measure button→fresh holdings, button→correct period result, and background-history completion→second correct result separately; count whether overlapping manual-refresh/background requests cause avoidable repeated full reloads. Cover slow/failing one-month history, owner change, and a second manual refresh while history is pending. Preserve forced history collection after settlement, deduplication and new-data visibility; never invoke real broker sync merely to benchmark it. First inspect existing build141/build197/build242 sync/refresh guards. Only implement if a reproducible redundant wait/reload can be removed without suppressing newly settled data. Current operating intermittent-latency distribution and actual iPhone lifecycle remain open.
