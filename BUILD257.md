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

Pending: final exact-commit full CI, fresh main lease, apply reviewed function migration, compare deployed body/privileges, guarded main promotion, Pages success and HTTP version marker verification. No deployment claim until recorded below. Rollback: original Build247 realized function; no data rollback needed. Existing application and ledger remain unchanged until the gates pass.
