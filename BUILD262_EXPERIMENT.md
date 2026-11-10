# Build262 experiment — current SQL refresh attribution, ordering candidate rejected

2026-11-10 KST. No Build262 product release. Live Build261 retained.

## Fresh state and authorization scope

Read latest main71386cb45109e2232d2f7a298c2a7fb7d5c2a79d and work be794d8e37857038e6cc99d226dc10d6bf0661ff, BUILD261 handoff, CI42722843360 and additional main CI42725117578 (both success), Pages42725117323(success). Fresh live version.json returned2026-11-10-sale-quantity-format-261. No competing branch changes or CI runs found. Existing automation run was current; no duplicate branch or schedule created. Local product source not modified. All experiments intercepted browser requests and used synthetic local SQL; no operating financial reads/writes or server changes.

## New baseline: refresh with the deployed SQL

experiments/refresh-current262.mjs extends the actual refresh/auth/request-queue/render path. Actual realized259 and stock260 SQL in PGlite, NAV and other APIs stubbed. One security/3000 synthetic trades, four unrelated synthetic holding UI rows, fixed SQL date2026-11-09, Chromium140/Playwright1.55.1,390×844,unthrottled CPU,50ms transport. Warm SQL plans. Explicit refresh invokes refreshLive(true,false): broker synchronization time is excluded. Prior amounts may be retained as previous results; observer requires a new result object, correct period/date/amount or unknown label, and two animation frames. Full final stock+realized outputs equal expected fixtures for every sample. Exactly2 period RPCs and52 total requests per refresh. Metadata request counts include other synthetic reads, not operating-network measurements. Original fixture is already authenticated and visited: this is not a cold first-visit benchmark.

36 samples: four periods×three repeats×normal / extra1000ms home-review responses / extra1000ms holdings response. Trace separates refresh→request initiation, client queue, RPC round trip, local SQL, rendering and correct paint. SQL is contained in RPC time; do not sum overlapping intervals. Raw performance/refresh-current262.json.

|Period|Normal refresh→correct paint median,ms|Slow reviews|Slow holdings|Normal complete refresh median,ms|
|---|---|---|---|---|
|1W|641.9|641.0|1601.6|1348.8|
|1M|622.3|634.8|1583.7|1299.5|
|3M|652.2|607.6|1583.8|1305.3|
|ALL|867.9|875.4|1834.0|1538.5|

Review latency mostly remains outside first correct total; do not redo the already-deployed priority refill work. Holdings latency delays fresh totals because fresh balances are required; showing previous balances as new is not an optimization. A new observed queue issue is that retained previous total triggers realized composition during the loading render, before the fresh total request is submitted. The serialized calculation queue then puts total behind realized. Baseline queue median is roughly300ms for short periods and500ms for ALL. Max three hypotheses: this request order, required core-read delay, and post-paint enrichment. Tested request ordering first.

## Candidate and same-condition comparison

experiments/refresh-order262.mjs generates a separate HTML candidate from Build261. Adds !live.stockPnlLoading only to the total-view automatic realized-load condition in bindBrokerDay. Realized view still calls its loader immediately, but the underlying serial queue can already be occupied. No change to formulas, caches, expiry, RLS, account scopes, or API payloads. Candidate remains outside index.html and must not be shipped.

Five alternating source pairs/period, same dataset/browser/screen/CPU/transport/SQL/cache conditions (40 refresh samples), normal network only. All complete financial responses and displayed amount assertions pass. Each sample keeps2 period/52 total requests. Raw performance/refresh-compare262.json. Reproduce by exporting BASELINE_UI/CANDIDATE_UI and running experiments/refresh-compare262.py. Use git show71386cb:index.html for baseline and the generator for candidate. These are synthetic measurements, not production speed improvements.

|Period|Refresh→paint before median(range),ms|Candidate median(range),ms|Complete refresh before→candidate median,ms|
|---|---|---|---|
|1W|639.0(623.1–663.5)|379.4(364.2–390.1)|1320.8→1308.7|
|1M|646.1(626.7–665.9)|381.3(364.0–392.1)|1335.3→1316.1|
|3M|645.0(614.3–691.5)|378.3(374.8–381.1)|1316.0→1299.1|
|ALL|894.1(854.6–947.1)|425.7(422.5–430.0)|1567.5→1548.0|

## Blocking regression: first realized-view interaction

Used existing tests/refresh_view_switch253.mjs through experiments/refresh-switch262.py,3 alternating pairs,Chromium390×844,50ms synthetic responses and a controlled1000ms held total response. On total request entry, click realized view and wait for fresh realized state. This is a stubbed isolation test, not an actual SQL throughput benchmark. Baseline immediately fresh3/3, candidate0/3. Baseline latency median40.7ms(range39.7–47.2); candidate1167.5ms(1154.2–1172.6). Candidate keeps the explicit-view loader call but cannot bypass the already-running total in the single calculation queue. Raw performance/refresh-switch262.json. Therefore the first-interaction requirement fails: reject the candidate despite faster first total. Do not widen calculation concurrency or cache old realized amounts to mask it; those approaches already had regression evidence.

## Outcome and next action

No product code, version bump, new CI or deployment. Build261 remains live. Recorded new actual-SQL refresh baseline and a concrete rejected candidate, not improvement completion. No need for WebKit/physical iPhone validation of a rejected candidate; future shipping candidates still require both engines,390/402/430px,125%,financial and stale-response regressions. This run does not claim cold-cache/production DB timings, p95, or memory improvements.

Next independently test post-paint enrichment under a larger holding set: earlier swing-history batch prototype reduced calls but was not proven safe under failure/RLS/response truncation. First add equivalence, per-security160-row limit/order, one-security failure isolation, cap/truncation and authorization fixtures before considering the prototype. Do not rerun the same ordering benchmark or ship a blanket total-first gate. Reconnect checks should next distinguish retained-session within3-minute TTL (no unnecessary full refresh) from expired-session/current-SQL reload; no old result may become current without a fresh calculation. Required core holdings latency must remain visible as a freshness constraint.
