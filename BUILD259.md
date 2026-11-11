# Build259 — reuse authorized daily realized records

2026-11-10 KST. Continue work/performance-detail-render-234 from f6b56d8. Fresh main c3f04cb, Build258 live; CI42693003841/42695432287 and Pages42695429969 successful, no competing workflow run. No application UI/financial definitions changed. This release changes only realized SQL record retrieval and release markers.

## Evidence and scope

The preceding combined-response candidate remains rejected: it delayed first totals and coupled independent failures. Current work follows the committed concentrated-history hypothesis, not a repeat benchmark without a hypothesis.

Read-only gateway aggregates 2026-11-09T20:41:00Z–22:32:00Z show realized RPC5 calls,1 server error,max upstream21405ms; stock RPC1 call,1489ms. No account identifiers or financial rows retrieved. This small sample does not identify the cause of the operating error or establish percentiles. Production function bodies match realized257 a0ebdce3dd5c47542b2f2d06a1e055cb and stock258 a277ec6fa970b927be58c933eba5672e.

Synthetic phase attribution: same3000 transactions,100 securities×30days vs1×3000days,1W/1M/3M/ALL,5 warm runs/shape/period. Instrumentation-stripped complete responses equal uninstrumented SQL. Single-security ledger phase medians5730/5674/5618/5675ms; nested stock61/57/61/100ms (included inside closed phase, not additive). The concentrated-history delay is the ledger phase, not the nested stock call. Raw performance/ledger-phase259.json.

## Change and invariants

The existing authorized per-security daily GROUP BY now retains buy/sell records as a typed transactions[] aggregate. Each day's existing loops read those records via unnest, instead of rescanning the account/security history for each day. Mixed days still order by id; ordinary days by trade_at,id. The grouping scan still includes corporate/transfer events, and a day with no buy/sell records yields an empty unnest without removing its unknown-cost effect. Exact numeric types are preserved without a JSON round trip. No cross-request cache, added RPC, index, history truncation, timeout increase, privilege/ACL/config change, new UI, or calculation-version change. STABLE/SECURITY INVOKER and current account filters remain. The statement snapshot and original historical-date/FX/fee/tax/unknown logic are preserved.

Source supabase/build259_daily_realized_records.sql; CLI-created review migration20261109223952_reuse_daily_realized_records.sql is byte-identical. Candidate body MD5 e12bff60b8396b2200165330ef2674b2. Hosted application must use a guard checking the original body hash and verify the resulting hash/ACL/config before promotion. No operating financial writes.

## Repeated comparison

Local PGlite0.3.14 with representative indexes and fixed2026-11-09; NAV stubbed. Identical synthetic fixture per pair, unthrottled CPU, no competing benchmark; alternating order, both SQL plans warmed. SQL3 shapes×4periods×5pairs=120 measured queries; every complete response equals baseline. Raw performance/ledger-day259.json. This is not production DB latency.

|Transactions / securities|Period|Before median (min–max),ms|After median (min–max),ms|
|---|---|---|---|
|300/1|1W|119.8 (115.9–125.3)|62.4 (57.7–71.1)|
|300/1|1M|110.7 (103.9–113.9)|54.3 (51.9–58.3)|
|300/1|3M|114.5 (106.8–120.9)|58.9 (56.8–62.2)|
|300/1|ALL|120.3 (115.2–124.3)|69.3 (66.1–69.8)|
|3000/1|1W|5722.2 (5505.0–6018.7)|199.4 (182.5–214.4)|
|3000/1|1M|5704.2 (5419.6–6304.5)|176.8 (170.7–186.4)|
|3000/1|3M|5453.4 (5411.6–5562.0)|188.1 (179.2–263.5)|
|3000/1|ALL|5837.2 (5722.5–5932.8)|355.9 (347.6–370.7)|
|3000/100|1W|561.5 (550.0–598.9)|472.0 (461.4–486.6)|
|3000/100|1M|733.3 (721.2–814.0)|648.2 (647.9–727.7)|
|3000/100|3M|729.5 (717.2–778.2)|654.0 (647.3–699.0)|
|3000/100|ALL|664.2 (623.6–704.8)|571.1 (556.0–611.0)|

Actual browser loader and renderer, Chromium140.0.7339.186/Playwright1.55.1,390×844,unthrottled CPU,50ms synthetic transport each request,3000 trades/one security,application result caches cleared each sample,5 alternating pairs/period. Actual realized and nested stock SQL; NAV stubbed, the independent stock-view response and other APIs use the unchanged synthetic browser fixture. Every full realized response and rendered total matches; one realized and one stock request per measured selection. Request-start→first correct two-rAF display is distinct from host click→settled measurement. Raw performance/ledger-browser259.json. No physical iPhone or real network claim. Five pairs report ranges, not tail percentiles.

|Period|Before request→paint median (min–max),ms|After request→paint median (min–max),ms|Before→after SQL median,ms|Before→after render median,ms|
|---|---|---|---|---|
|1W|6107.7 (5875.9–6158.4)|277.0 (276.7–306.7)|6027.6→195.9|14.2→12.6|
|1M|5976.2 (5825.8–6059.6)|277.4 (260.1–290.6)|5889.7→194.2|12.2→11.4|
|3M|5976.6 (5660.9–6560.4)|288.6 (261.4–294.4)|5902.8→203.5|12.3→12.9|
|ALL|6268.1 (5990.6–6408.2)|504.6 (483.6–518.4)|6142.6→391.6|61.7→65.7|

Small300-trade browser cold-cache request→paint medians1W/1M/3M/ALL192.4/209.3/209.8/210.7→140.6/126.5/143.4/160.5ms (3pairs each). With valid stock cache retained on return visits,191.9/207.8/224.3/222.1→142.3/127.5/142.3/160.7ms; realized remains uncached and still makes one request, stock cache hits make zero additional stock RPCs. Raw performance/ledger-browser259-small.json and ledger-return259.json include ranges and request counts. No result cache or invalidation rule changed.

Rapid ALL request followed150ms later by1W,3000trades,3alternating pairs: latest correct paint 11676.5 (11633.0–11762.3)→602.1 (559.9–626.3)ms. Each trial runs exactly the original ALL and latest1W SQL; final full1W output and rendered total equal baseline, existing serial queue preserved. Raw performance/ledger-rapid259.json. No claim that running database work is physically cancelled; reduced old-query work also shortens the queue wait.

Memory:6 fresh Node/PGlite processes,3 alternating pairs,3000 trades/one security,5ALL queries/process. Peak RSS before868.6–881.8MiB,after869.2–909.5MiB; medians873.0→869.7MiB, ranges overlap, one candidate peak higher. Post-GC final heap17.2 vs17.2–17.3MiB. No persistent cache introduced; per-query typed records are released. This coarse whole-process metric includes Node/WASM/fixture and does NOT prove production Postgres memory or iPhone memory equivalence. Full hashes equal. Raw performance/ledger-memory259.json. Larger provider payloads/very large single-day groups are not represented.

## Verification and delivery

31 full differential daily-record checks (including corporate-only NULL aggregate, same-side ordering and another account sharing a security);16 recovered-date/grouped-fill/mixed/invalid-source comparisons; Build247 settlement/rounding/dedup and Build246 observation/FX/full-exit/all-period invariants. Existing financial rules remain regression gates. Browser checks390/402/430px at100/125%, correct full data and no horizontal overflow; CI also runs existing buttons/back/goal/decision/chart/cache regressions in Chromium and WebKit. Local WebKit dependency limitation remains; CI is the second-engine gate. Physical FaceID/native keyboard/PWA full termination not performed.

Delivery completed together with Build260; exact CI, migration and live deployment evidence is recorded below and in BUILD260.md.

## Next bottleneck examined in the same execution

After the main fix's measurements, expanded the unchanged stock258 SQL for local EXPLAIN ANALYZE (100securities×30daily trades,1W/ALL,3warm runs each,NAVstub). In the first1W plan, the closed-cycle quantity check repeatedly scanned dated_transactions100times (2400 qualifying rows/pass;600 rejected/pass), about190.8ms inclusive across loops; ALL also scanned3000 excluded rows100times,about114.9ms. These are instrumented inclusive node timings, not additive phase totals or a speedup. Top32 nodes per plan retained in performance/stock-plan259.json; regenerate FULL_PLAN=1 for full trees. No planner-driven change is included in this release.

The following hypothesis was subsequently implemented and validated as Build260 in this same execution (see BUILD260.md): compute the pre-start net quantity once per asset for closed_cycles inside the same statement, preserving all corporate/transfer position_delta rules, effective dates, account/keys joins, exact zero requirement, NULL behavior, and source validation. Compare full stock responses before/after across1W/1M/3M/ALL,100vs1security, empty and non-flat/pending/missing cases before deciding. This continues the measured stock bottleneck; do not revisit the rejected monolithic RPC or stale realized cache. UI ALL render~60–76ms remains observed, but attribution to row aggregation is unproven and lower priority than the measured SQL scans.


## Delivery outcome — 2026-11-10 KST

Exact candidate e2f1c06881278cf38f12e82818c6553cd0f4a5c2 passed CI42715887432. Both measured changes were then combined in Build260 a67fbe47803f7add4a180c2182bc3b501dc64d50, whose exact-SHA CI42717690775 passed all mobile and decision-regression jobs before production mutation. No intermediate Pages259 deployment was made. Hosted migration reuse_daily_realized_records version20261109231943 applied successfully with prior/candidate body-hash guards; deployed realized body MD5 e12bff60b8396b2200165330ef2674b2. Invoker/STABLE/configuration/ACL preserved, advisory categories unchanged. See BUILD260.md for final Pages/live proof and follow-on measurements. Operational financial rows were not written.
