# Build260 — grouped opening quantity for period totals

2026-11-10 KST. Continues the independently measured stock bottleneck recorded in BUILD259.md while Build259 exact-SHA CI runs. Build259 addresses concentrated long-ledger scans; this change addresses repeated pre-period quantity scans across many securities. It does not repeat or replace Build259's fix. Before comparison is stock258 with realized259; after is stock260 with unchanged realized259.

## Measured hypothesis and change

The stock258 expanded EXPLAIN plans showed the closed-cycle check rescanning dated_transactions100times for100securities. The candidate computes precisely the same pre-start net quantity once per asset in a materialized CTE, keeping account and keys joins, bounds date, effective-time precedence/timezone, all buy/sell/split/transfer/corporate event cases, position_delta fallback, NULL/coalesce semantics and exact numeric zero requirement. Calculated positions take their start_date from the same single bounds row. A missing aggregate remains zero, exactly as the original empty SUM; an unknown financial amount is never replaced with zero. Nonzero pre-period corporate quantity still blocks a confirmed flat-to-flat cycle. No change to prices/cost/FX/fees/taxes/status/period/account definitions, filters, source validation, schema tables, timeout, grants, RLS or UI.

Source supabase/build260_closed_opening_quantity.sql and identical CLI-created20261109225556_aggregate_closed_opening_quantity.sql. Guard hosted original stock body hash a277ec6fa970b927be58c933eba5672e. SECURITY INVOKER/STABLE/search_path/jit/work_mem16MB/timeout20s retained. No operational financial writes.

## Same-condition SQL comparison

PGlite0.3.14, fixed2026-11-09, NAV stubbed, representative indexes, synthetic daily buy/sell ledger.120queries:3shapes×4periods×5 alternating pairs, both plans warm. Full responses equal for every pair. Raw performance/closed-opening260.json. No operating DB or network speed claim; 5pairs do not establish tail percentiles.

|Transactions / securities|Period|Before median (min–max),ms|After median (min–max),ms|
|---|---|---|---|
|300/1|1W|34.3 (34.0–39.9)|35.6 (34.4–37.9)|
|300/1|1M|33.6 (32.8–39.1)|33.4 (32.8–74.9)|
|300/1|3M|34.8 (33.6–38.0)|36.1 (33.9–37.3)|
|300/1|ALL|40.7 (39.7–46.1)|41.5 (38.7–42.7)|
|3000/1|1W|58.5 (57.4–63.3)|61.1 (59.1–70.7)|
|3000/1|1M|55.8 (53.1–59.6)|55.0 (54.1–61.9)|
|3000/1|3M|64.0 (60.3–67.4)|62.0 (61.2–65.5)|
|3000/1|ALL|110.8 (105.8–158.9)|106.6 (102.2–113.9)|
|3000/100|1W|271.4 (268.5–274.9)|136.5 (135.1–144.0)|
|3000/100|1M|303.1 (301.7–308.7)|185.1 (181.1–188.9)|
|3000/100|3M|317.3 (309.1–320.6)|199.2 (197.0–200.9)|
|3000/100|ALL|307.1 (278.9–314.7)|180.5 (176.5–183.8)|

Single-security samples are broadly unchanged; do not claim a meaningful extra improvement there. The large, separated ranges are in100-security histories.

## First total, then complete composition

Chromium140.0.7339.186/Playwright1.55.1,390×844,unthrottled CPU,50ms simulated transport,100securities/3000trades,both SQL plans warm,application caches cleared.5alternating pairs/period. Actual stock SQL and actual realized259 plus its nested stock execute; NAV and other APIs are synthetic stubs. Every complete stock/realized response equals baseline, correct displayed first amount verified; exactly2RPCs per selection before/after. First correct stock paint is measured separately from waiting for both results. No loss of the earlier independent total/error behavior rejected in the prior combined-RPC experiment. Raw performance/closed-browser260.json.

|Period|First total before median(min–max),ms|First total after median(min–max),ms|Click→both settled before→after median,ms|
|---|---|---|---|
|1W|407.5(380.9–448.0)|262.4(249.3–285.1)|1012.9→744.3|
|1M|430.7(405.1–444.8)|295.3(278.9–306.4)|1231.6→964.3|
|3M|418.6(402.4–456.4)|296.5(284.9–310.0)|1217.6→961.4|
|ALL|376.4(371.3–424.3)|264.3(255.7–271.1)|1073.8→832.1|

Small300-trade/one-security request→paint medians1W/1M/3M/ALL110.4/110.0/111.0/126.2→126.1/110.3/110.9/126.9ms; ranges overlap and there is no meaningful claimed speedup here (one-frame differences). The browser comparison uses3pairs/period and includes unknown opening-price states: unknown remains explicitly 미계산/미확정, not0. Raw performance/closed-browser260-small.json. Incomplete-result UI required a corrected diagnostic observer; an earlier harness that expected a numeric headline timed out, and its partial samples were discarded. A separate early diagnostic selector matched two hero panels; selecting the primary period-total hero fixed the harness, with a full clean rerun above. No application UI change was made for either test issue.

## Regression and delivery gate

61 complete stock differential checks cover nine supported periods, empty/null, current/previous date boundary, nonzero corporate and position_delta adjustments, grouped aliases, pending evidence, account/auth and upstream failure. Also rerun Build259's31 full realized checks and16 recovered-date/mixed-day checks using stock260, plus CI's existing financial/UI/cache/back/decision/goal/chart suites. Browser390/402/430px and125% overflow checks; WebKit validation through required CI (local system dependencies unavailable). Physical iPhone/FaceID/native keyboard/PWA termination not tested.

Final-SHA CI and guarded migration/main/Pages/live-marker checks remain required. This preparation file is not a deployment-complete claim.

Candidate body MD5 3e5ad3861856d47c9e857e9ac0ecca3c.

Memory:6 fresh processes,3 alternating pairs,100securities/3000trades,5ALL realized259 queries with selected stock function per process. Whole Node/PGlite peakRSS before873.3–882.5MiB,after854.1–874.9MiB; post-GC finalheap17.2–17.3 vs17.3MiB. Full output hashes match. This is coarse local WASM/process evidence, not proof of server/iPhone memory behavior or a formal leak test. Raw performance/closed-memory260.json.

Rapid ALL→1W after150ms,100securities/3000trades,3alternating pairs: newest correct total 623.3(616.0–665.5)→352.3(315.0–365.1)ms. Exactly old stock ALL, latest stock1W and latest realized1W execute; full latest stock+realized results match, older in-flight response does not replace the selected period. Raw performance/closed-rapid260.json.
