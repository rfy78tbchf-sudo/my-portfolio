# Build257 — accumulate realized sale objects once

Entry: main c95ee69 (live frontend256), work branch7362dac, exact-SHA CI42680380693 and Pages42682805007 successful. Continued existing work/performance-detail-render-234. Read-only function metadata/body inspection confirmed deployed realized-sales-v12-settlement-precision exactly matches the body in the Build247 migration; do not use Build245 alone as the current backend baseline. Operational access in this run: function definitions, indexes and advisor metadata only, no financial rows or ledger writes.

## Evidence and implementation

A30-second realized-detail cache was tested first and rejected. Actual Chromium390x844/full loader, four holdings,50ms intercepted responses,1W/1M/3M/ALL five samples each: return median133.4ms (132.5–150.9) versus66.7ms (66.3–82.7), RPC1→0. However a synthetic pending estimate17 revised to settled net/cost/fee/tax profit15 was still displayed as17 by the cache. The baseline read15; forced refresh recovered15. Do not deploy this TTL prototype. Raw performance/realized-cache256-*; experiments/realized-cache256.mjs. Those timings are not time-to-correct-result once the source changes.

Profiled the actual realized function plus nested current stock function in local PGlite at fixed2026-11-09. NAV is explicitly stubbed/excluded. Fixture has10/100 securities ×30 USD buy/sell transactions, daily FX and representative production lookup/primary indexes; observation, domestic and pending tables are empty in the scale benchmark. Five samples per period/size. Every profiled complete result equals the uninstrumented function. For3,000 transactions, ALL median4238.3ms: ledger loop3889ms, nested stock297ms, final estimate projection38ms. Initial diagnostic omitted primary-key indexes and overstated estimate-projection cost; discarded/replaced before deciding. No new index or concurrency change.

The three ledger/pending append sites now use a jsonb[] accumulator and convert it to the existing JSON array once before official-source reconciliation. All formulas, row order, source precedence, empty-array behavior, null values, closed-cycle logic, historical FX, estimation, settlement matching, authorization, privileges, query scope and cache freshness remain unchanged. Release drops the temporary array reference after conversion. Financial calculation_version remainsv12 because definitions are unchanged. Only frontend build/cache markers change; no UI redesign or additional requests.

Instrumented SQL medians, baseline→candidate (ms):

|Transactions|1W|1M|3M|ALL|
|---|---|---|---|---|
|300|88.9→89.8|80.6→82.5|93.4→87.7|146.6→116.1|
|3,000|475.2→416.8|584.6→482.6|898.0→511.1|4238.3→725.8|

Raw performance/realized-sql-profile256.json and realized-array256-candidate.json. Separate sequential diagnostic runs, not randomized production trials. Subcall time is included in closed-phase time and must not be summed twice. No short-period gain claim where changes overlap noise.

## Browser comparison

Actual startup/auth/read queue/rendering; Chromium390x844, no CPU throttle, shell warm, application total cache cleared before each sample,50ms intercepted transport plus **actual local SQL execution** for realized requests. Nested stock SQL executes; top-level total request remains the existing synthetic mock, NAV stubbed.1W/1M/3M/ALL, three alternating baseline/candidate pairs each size,24 samples/size. Measure click dispatch through correct full result, matching rendered sum/all security rows, queue idle and two frames. One realized and one top-level total RPC each in every sample. No production DB/network or physical iPhone speed claim. Small sample sizes: no tail percentile.

|3,000 transactions|Before median (min–max) ms|After median (min–max) ms|
|---|---|---|
|1W|691.7 (668.2–812.9)|685.2 (682.0–785.4)|
|1M|820.5 (782.1–825.4)|766.7 (747.3–815.5)|
|3M|1177.2 (1141.4–1236.7)|749.3 (747.9–825.8)|
|ALL|4357.3 (4223.9–4654.4)|1063.5 (1043.1–1083.3)|

300-transaction first-query medians1W/1M/3M/ALL:273.5/271.7/263.5/339.1→289.3/287.5/265.0/310.2ms. Short-period differences overlap observed variation; not claimed improved. Raw performance/realized-browser257{,-small}.json; experiments/realized-browser257.mjs. Result size/order and requests unchanged; browser input/queue/cache algorithms unchanged. No measured production server peak-memory claim; accumulator is request-local and released after conversion.

## Validation and release gate

Local Build257 full-output differential27 checks cover all supported test periods, mixed-day unknown cost, pending, official domestic profit, repeated identical results, account isolation, auth rejection, no ledger mutation and empty accumulation. The complete Build246 historical-average/FX/exit suite and Build247 settlement-precision suite run against optimized SQL; their every successful result is also compared to originalv12. Existing expectations/timeouts remain intact. Build72 update marker test passed. CI includes these and actual-SQL browser flows in Chromium/WebKit, plus existing390/402/430px,125%, back navigation, financial/wealth/decision/chart regressions. Local WebKit lacks system libraries; CI is the WebKit gate.

Known pre-existing edge case discovered in the synthetic fixture: current nested stock function may return JSON null items for an empty TODAY period, and original realized function raises22023. The optimized function raises the same error; the differential test records parity, not success. The independent empty-accumulator test supplies a valid empty-array dependency and returns[]. This release does not turn query failures into zero. Next action: separately reproduce this empty-period contract with bounded fixtures and distinguish missing evidence from no activity before deciding a guard/fix. Do not weaken the financial error contract to pass a test.

Release gate recorded before rollout (completed below): final exact-commit full CI, fresh main lease, apply reviewed function migration, compare deployed body/privileges, guarded main promotion, Pages success and HTTP version marker verification. No deployment claim until recorded below. Rollback: original Build247 realized function; no data rollback needed. Existing application and ledger remain unchanged until the gates pass.

## Matched-plan follow-up on the same candidate

The first three-pair browser comparison precomputed expected outputs with the original function; the candidate's first SQL call could still include plan compilation. A supplemental wrapper warms **both** functions with every compared period before measuring, then clears application result caches identically. Use these final five alternating pairs/period/size (40 samples/size), not the initial triads, as the matched-condition release comparison. Same actual application loader, Chromium390x844, unthrottled CPU,50ms intercepted transport plus local PGlite SQL, fixed2026-11-09, NAV excluded. Complete response equality, visible sum/all rows and one realized/one top-level total request passed for every sample. These remain synthetic observations, not operating DB/network measurements.

|3,000 transactions|Before median (min–max) ms|After median (min–max) ms|
|---|---|---|
|1W|685.1 (646.3–686.5)|639.8 (590.9–684.3)|
|1M|699.0 (683.6–728.3)|661.8 (631.5–711.8)|
|3M|1123.7 (1051.3–1315.5)|709.2 (707.5–726.2)|
|ALL|4589.7 (4196.6–4659.0)|1058.9 (975.4–1093.0)|

300-transaction medians1W/1M/3M/ALL:267.0/269.1/266.6/320.9→272.4/255.6/265.9/293.6ms. Short-period ranges overlap; no blanket first-query speed claim. Raw performance/realized-warm257{,-small}.json; experiments/realized-warm257.mjs. Five samples do not justify a production tail percentile.

Next-input blocking also measured with actual local SQL: warm ALL, force its realized read, select1W from a browser timer150ms later. Require the old request's dispatch before the new input and its completion after that input; current1W full result and visible total must match. Three alternating pairs: latest-selection paint median4710.1ms (4660.8–4825.8)→1220.8ms (1180.2–1304.9). Raw performance/realized-rapid257.json; experiments/realized-rapid257.mjs. This confirms lower old-query CPU work reduces the wait inside the unchanged serialized lane; it does not claim browser cancellation stops server SQL.

Bounded repeated-use memory check: six fresh local Node/PGlite processes, three alternating pairs,3,000 transactions/1,500 sales, five ALL queries/process, same output hashes. Maximum whole-process RSS ranges852.4–896.6MiB original versus868.1–881.7MiB candidate overlap. Post-GC Node heap stayed17.8MiB at all five checkpoints in both sources. Final RSS varies and is not a formal leak test. Includes fixture/WASM/Node allocation; not production Postgres peak memory, browser memory or iPhone measurement. Raw performance/realized-memory257.json; experiments/realized-memory257.mjs.

## Verified release and continuation (2026-11-10 KST)

Application commit2fa3f64a4697dcfd823b594ca8aa650e5b7234fe passed full required CI42686945297 (both jobs; Chromium/WebKit and comprehensive mobile/financial regressions). Rechecked mainc95ee69 and work branch2fa3f64 before deployment. Applied accumulate_realized_items through the Supabase connector, with an expected-original-function MD5 guard to avoid overwriting an intervening backend change. Server migration history version20261109200544; the CLI-generated review file is20261109194323_accumulate_realized_items.sql. These are recorded identifiers, not a claim of aligned CLI migration history (older repository migration filenames also differ from server history); do not blindly push the local history to production.

Live function body MD5a0ebdce3dd5c47542b2f2d06a1e055cb matches reviewed SQL; original wasc105ab50dfa04a6d403fb56f46229126. SECURITY INVOKER, STABLE, empty search_path, jit=off,20s statement timeout and existing postgres/authenticated/service_role execute ACL are unchanged. Live no-session invocation rejects with authentication required. Security/performance/health advisor category/count summaries are unchanged. No operational financial rows were selected, generated, backfilled or changed; production financial-output equality is not claimed from metadata checks.

Main was guarded-fast-forwarded to2fa3f64. Pages42689672329 succeeded for that exact SHA at2026-11-09T20:09:16Z. Independent HTTP200 reads of version.json, index.html and sw.js verified2026-11-10-realized-accumulation-257 and shell cache my-portfolio-shell-2026111003-257 at approximately05:10 KST. Main-triggered duplicate CI42689673888 was still in progress; the complete successful exact-SHA prepromotion CI is the release gate. Physical iPhone Face ID/native keyboard/PWA lifecycle and operating end-to-end latency remain unmeasured.

The matched-plan/rapid-switch/memory follow-up artifacts and this release record are committed on the existing work branch without another application change or redeployment. Final release comparison is the five-pair matched-plan table above. The30s TTL candidate remains rejected; calculation concurrency stays1 and every realized requery still observes fresh source data. Do not rerun the rejected cache or concurrency changes without new evidence.

Next action: start from fresh main/branch/CI/Pages, then isolate the empty-period nested-stock JSON-null contract already reproduced by Build257's differential fixture. Preserve the distinction between no activity and missing evidence; do not change failures/unknown amounts to zero. For remaining intermittent latency, attribute stock-total/NAV subcalls and actual upstream wait separately before proposing reuse or parallelism. The current scale fixture excludes NAV and does not establish production I/O/lock behavior. Continue to refresh/startup/detail bottlenecks only after materially larger period-query work is addressed or lacks a reproducible improvement. No new financial original is needed for those synthetic performance investigations.
