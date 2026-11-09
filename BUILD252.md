# Build252 — reuse corporate-event candidates within a period query

2026-11-09. Continue work/performance-detail-render-234 from53a7285, main ef316c3/live251. Verified latest main/work refs, completed CI/Pages and direct version.json. No active runs at start. This follows the recorded large-history gate; no repeat of the rejected opening-quantity optimization.

## Change and correctness
Materialize account-owned corporate-event candidates once per query rather than repeating their extraction for each asset. Preserve exact excluded types, verified-IPO evidence IDs, original asset keys, effective-date fallback, start boundary and cutoff. No cache, new requests, UI/function additions, ledger writes or cost reconstruction. Existing Build251 domestic/native reconciliation, Build245 estimates, fees/taxes, currency/account scope and annual-goal behavior remain unchanged.

Migration guard b08fe9c5e0bab487b0dc1a64aad25800 →6aa21954163a2e536cd1525d10bb69e5. Idempotent on the exact target only; drift raises. SECURITY INVOKER and existing settings preserved. The final migration was applied twice in synthetic regression. Domestic/native boundaries,29 rejection cases, owner isolation and seven other-period comparisons passed locally; final required CI explicitly runs that deployment file.

## Evidence
Dedicated CI42604526196/job129116966207 passed on c18eedd9: Build251 reconciliation with candidate, then300 positions/5100 synthetic transactions containing120 valid IPO groups and220 corporate-warning items, aliases, malformed receipts and boundary events. Seven-period full JSON equality. Sequential browsers (no concurrent local benchmark), Ubuntu24.04, Playwright1.55.1,390x844,no CPU throttle,100ms fixed synthetic transport,five alternating fresh pages per version/period. Each first result has one RPC; cached return has zero additional RPCs and equal output. The measurement ends after the result and two animation frames, includes PGlite execution and rendering, and is not production network or iPhone timing.

|Period|Chromium median before→after ms (ranges)|WebKit median before→after ms (ranges)|
|---|---|---|
|1W|812.8→725.2 (811.3–814.3 /722.2–726.2)|884→792 (880–964 /789–813)|
|1M|818.4→728.1 (815.1–824.5 /726.7–734.8)|904→814 (902–920 /811–816)|
|3M|847.0→756.5 (842.2–852.5 /750.6–763.0)|916→833 (910–919 /825–845)|
|ALL|1603.9→1383.6 (1597.0–1634.6 /1382.3–1395.1)|1684→1464 (1672–1692 /1454–1466)|

Fresh production-data comparison used complete deployed251 and candidate SQL bodies in authenticated repeatable-read/read-only transactions, jit=off/work_mem=16MB. All seven period JSON outputs identical. No data mutations. Five alternating EXPLAIN ANALYZE samples after result comparison, execution only:
-1W before413.076,426.692,437.337,473.955,442.254; after392.858,393.452,433.043,423.206,412.826ms. Medians437.337→412.826; ranges413.076–473.955 /392.858–433.043.
-ALL before1285.257,1290.757,1298.279,1459.636,1426.469; after991.747,1087.382,1029.930,1062.133,1108.890ms. Medians1298.279→1062.133; ranges1285.257–1459.636 /991.747–1108.890.

Small samples do not establish p95 or elimination of intermittent production delay. Memory peak, real network tail and physical iPhone unmeasured. Earlier100-position results are retained in docs/PERFORMANCE_AFTER_BUILD250.md; small-history improvements were modest and1M WebKit variance overlapped. Do not generalize large-history percentages to every user query.


## Release verification — 2026-11-09
- Final application commit e40184641247db15abbca21e9e31b92adb20b7bd passed required [Mobile portfolio layout CI42605282517](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42605282517), both jobs successful. Includes390/402/430px and125% layouts, Chromium/WebKit, exact252 migration applied twice in synthetic tests, financial/account/fee/tax/estimate cases, rapid period switching, saved judgments, refresh, detail return, charts and wealth regressions.
- Applied build252_corporate_candidates. Actual definition hash6aa21954163a2e536cd1525d10bb69e5; SECURITY INVOKER,stable,empty search_path,jit=off,work_mem=16MB,statement_timeout=20s preserved. No ledger/financial rows modified.
- Authenticated read-only post-apply comparisons: deployed function versus complete prior251 body, full JSON unchanged for all7 periods. Recent1W coverage6/6,complete=true,unmapped_count0,provisional_count1 remains. No private amounts/account IDs in this record.
- A batched seven-period post-apply comparison exceeded the tool timeout; identified and cancelled only that diagnostic backend. Replaced it with sequential per-period PL/pgSQL comparisons, each bounded by20s statement_timeout; all passed. Do not reuse the large UNION comparison. Security/performance advisors initially timed out during that diagnostic; retries matched pre-release notices exactly after ignoring observed_at. Health notices unchanged/empty.
- Refreshed main ef316c3fde79a0ca75e51b1a69278e488ab462ff immediately before guarded non-force fast-forward to the already-tested application SHA. No concurrent drift.
- [Pages42608035051](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42608035051) succeeded on e40184641247db15abbca21e9e31b92adb20b7bd. Direct HTTPS reads confirmed version.json and HTML appBuild/comment2026-11-09-period-corporate-reuse-252,SW cache my-portfolio-shell-2026110905-252. The main-triggered duplicate CI42608036394 runs the identical application; release gate was the successful final-SHA work-branch CI above.
- Physical iPhone Face ID/native keyboard/full PWA shutdown/relaunch were not performed. No claim of p95, memory-peak improvement or elimination of intermittent real-network delay.

## Next hypothesis checked during release validation
Ran tests/refresh_enrichment_diagnostic252.mjs using the actual stored-session/login path, read queue, refreshLive(true,false), rendering and synthetic four-position data. Chromium,390x844,no CPU throttle,50ms response delay, five alternating refreshes with an additional500ms/1500ms hold on get_live_benchmark_comparison. Every request is locally intercepted; no live writes. Fresh partial subtotal is checked in state and visible content, then two animation frames.

|Hidden benchmark hold|Fresh correct P&L median (range) ms|Refresh promise median (range) ms|Requests per refresh|
|---|---|---|---|
|500ms|746.8 (734.9–816.6)|1376.1 (1371.5–1441.2)|52 total,1 P&L|
|1500ms|743.9 (733.6–771.0)|2373.1 (2363.9–2399.2)|52 total,1 P&L|

Raw fresh-result samples:500ms [816.6,734.9,743.2,746.8,756.5];1500ms [771.0,743.9,733.6,750.8,737.2].
Raw completion samples:500ms [1441.2,1371.5,1372.3,1376.1,1399.3];1500ms [2399.2,2363.9,2366.5,2373.1,2378.3].
This rejects hidden benchmark completion as the cause of delayed **correct P&L paint in this fixture**; it does delay the refresh completion indicator. No app change made for this hypothesis: splitting completion must first prove benefit with real sync/background-history freshness and retry/navigation behavior, rather than merely announcing completion early. Chromium-only diagnostic, not physical iPhone or WebKit evidence.

Next concrete action: instrument queue-wait and response/paint timestamps for the52 non-home refresh reads, compare cold/revisit and delayed core/startup/selected-P&L responses with large synthetic holdings, and identify the critical path before pruning or deferring requests. Validate an actual benefit and both browsers before another release. Do not repeat the corporate benchmark or reimplement the completed251 reconciliation.

A separate instrumented diagnostic pass (same10 refresh cases) added in-page rpc/rpcNetwork timing. Selected P&L request median started212.8ms after refresh, waited117.4ms before network invocation, and resolved67.5ms later; app-settings requested213.5ms, queue61.0ms,response78.7ms; startup summary/chart requested359.7ms with0ms queue and61.3/63.5ms response medians. These measured client queue/response intervals include mocked transport and browser overhead, not DB processing. Instrumented fresh-paint medians807.2/796.2ms and completion1427.1/2439.7ms for500/1500ms holds confirm the same dependency distinction. Segment medians are not additive; do not label the unexplained remainder as rendering cost without direct timing. The committed diagnostic includes these trace hooks.
