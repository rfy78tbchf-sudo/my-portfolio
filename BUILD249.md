# Build249 — period evidence evaluation

## Starting point and scope
2026-11-09: main431713b / work7f7fdc3, frontend248, successful CI42554613496/42557205372 and Pages42554612628. Continue the same work/performance-detail-render-234 branch. Follow the next hypothesis in docs/PERIOD_LATENCY248_BASELINE.md, not a repeat of the queue fix. No production financial rows are written.

## Measured cause and selected changes
Current full SQL repeatedly evaluates correlated evidence expressions after the planner expands the evidence CTE into multiple classification/calculation expressions. Materialize that per-position evidence once within the RPC's statement snapshot. This is not a persistent cache: account ownership, period, date/FX evidence and freshness remain unchanged. Work_mem remains16MB.

The ALL path also repeatedly counts bounded-period membership matches even though domestic_period_membership explicitly excludes ALL. Skip that diagnostic count only for ALL. This does not set any missing P&L to zero. Bounded-period membership logic is unchanged.

Three candidates examined: (1) preaggregate four history trade counts; synthetic benefit, but production alternating runs overlapped (median2266.84→2247.35ms), so rejected; (2) evidence materialization, selected; (3) skip empty ALL membership count, selected after additional repeatable benefit. No query range truncation, new UI, concurrency increase or calculation formula change.

## Production read-only comparison
Five alternating before/after executions of complete SQL bodies, same read-only transaction, jit off, work_mem16MB. Includes dynamic SQL planning and execution, excludes network/browser; not a controlled cold cache or production RPC before/after deployment measurement. Exact JSON equality passed each run. No financial values or identifiers retained.

| Run | Before ms | After ms |
|---|---:|---:|
| 1 | 2758.19 | 1412.54 |
| 2 | 2461.53 | 1357.67 |
| 3 | 2898.53 | 1514.69 |
| 4 | 2356.62 | 1487.07 |
| 5 | 2468.24 | 1503.88 |

ALL median2468.24→1487.07ms (39.8% lower); ranges2356.62–2898.53 and1357.67–1514.69. Five samples do not support p95/p99 claims. Additional one-pair equality checks passed today/1W/1M/3M/6M/1Y for evidence materialization; the second change affects ALL only. Today timing overlapped/no proven improvement; do not claim every period improves equally.

## Validation and release gate
tests/fixtures/period248.sql is the complete deployed function definition, with no production data. PGlite0.3.14 runs the actual guarded migration twice, checks exact intended definition, compares entire JSON across history sizes and seven periods, then fourteen evidence/ownership mutations. Existing IPO/corporate/distribution/date/split/opening fixtures:142 cases,0 failures. Browser helper routes the real UI queues to this isolated SQL engine, fixed100ms synthetic transport,100 positions/3000 transactions,390x844, three alternating fresh pages per version/period; cached same-snapshot return must issue no additional RPC and preserve exact JSON. It is not a live network benchmark or physical iPhone test.

Required final CI (passed; see release verification below): both Chromium and WebKit, standard390/402/430px and125% display regression suite, update/version checks and existing queue/finance/wealth tests. Migration is definition-hash guarded; drift must stop deployment. Apply only the committed verified SQL, re-read definition and compare current RPC JSON with baseline in a read-only transaction, then guarded main promotion and Pages/version verification. The verified deployment outcome is recorded below.

## Next hypothesis
After verified deployment, inspect remaining repeated pre-period quantity checks in closed_cycles and per-row FX lookups; use a new plan and isolated scaling comparison before editing. Do not resurrect the rejected history-count-only change or add persistent caches without freshness evidence. Refresh/startup/tab/chart work follows the remaining major period bottlenecks. Actual mobile network/physical iPhone tails and process memory are not measured by this pass.

## Final isolated measurements
One benchmark process, PGlite0.3.14/Node24, fixed2026-11-09 clock, no CPU throttle, five measured alternating ALL runs after one warm-up pair. Synthetic balanced foreign transactions; missing execution dates stay local-only. Fixture dates include nonempty1W results. Earlier overlapping diagnostic runs were discarded.

| Transactions / positions | Before median (range) ms | After median (range) ms |
|---|---|---|
| 600 / 20 | 73.8 (70.4–82.9) | 58.7 (57.6–66.5) |
| 3000 / 100 | 477.9 (472.3–484.4) | 299.9 (297.4–310.0) |
| 6000 / 200 | 1581.8 (1538.0–1680.5) | 940.3 (914.8–942.0) |

Chromium390x844, same SQL fixtures with100 positions/3000 transactions, fixed100ms synthetic transport delay, three fresh-page alternating runs per version/period. Request start through two animation frames; one RPC each first query, zero additional RPC on cached return. No production latency or physical tap claim.

| Period | Before first median (range) ms | After first median (range) ms | Before / after cached median ms |
|---|---|---|---|
| 1W | 363.0 (347.1–364.6) | 346.1 (344.9–348.4) | 33.2 / 35.9 |
| 1M | 366.3 (364.2–401.2) | 364.0 (338.4–365.1) | 35.9 / 36.7 |
| 3M | 409.5 (395.2–410.9) | 378.0 (361.2–400.6) | 34.0 / 34.5 |
| ALL | 656.2 (651.8–667.7) | 480.0 (479.3–481.2) | 55.4 / 39.2 |

1M first-query and cached timings overlap; no blanket improvement claim. ALL isolated DB median1581.8→940.3ms at6000 transactions; browser median656.2→480.0ms at3000. Exact JSON equality and all mutations passed.

## Authenticated-role validation and next bottleneck
Read-only SET LOCAL ROLE authenticated with the existing owner's JWT sub set internally; no identifiers/output amounts retained. Alternating full SQL comparisons preserve exact JSON every time. ALL three samples before3697.93/3368.36/3444.62ms, after2385.55/2451.57/2347.92ms (medians3444.62→2385.55). Three samples each:1W median1666.48→1595.67;1M1645.36→1537.75;3M2086.03→1809.11ms. These include SQL planning/execution and RLS, exclude network/browser. Role-specific overhead must not be inferred by subtracting separate benchmark windows.

A follow-up authenticated1W plan confirms repeated realized_pnl_events scans inside domestic_date_candidates are a substantial remaining cost (approximately994ms inclusive across1016 scan loops). It is a concrete next hypothesis: isolate owned broker evidence once before individual/group date matching, then test ambiguous/grouped evidence and multiple-user RLS equivalence. Do not change policies or bypass RLS. This candidate was not implemented in this pass (three candidates already evaluated). Updated ALL plan: evidence evaluated once, no temp read/write blocks at work_mem16MB; no peak process-memory measurement. Remaining corporate-event and pre-period quantity subqueries also repeat. Do not sum inclusive plan timings.

## Release verification
Application commit668b45178d7a15cad533275f2b47c7d072649c68 passed branch CI42566095785: decision-regression20/20, mobile81/81 including Chromium/WebKit,390/402/430px,125% and original finance/wealth/navigation tests. CI browser ALL first-result medians (three runs, same synthetic3000 transactions/100 positions/100ms transport): Chromium798.3→555.4ms; WebKit934→695ms. These are separate runner measurements from the local table above.

Applied guarded migration build249_period_evidence_once. Post-deployment authenticated-role, repeatable-read, read-only verification compared the deployed RPC function against baseline full SQL for today/1W/1M/3M/6M/1Y/ALL; all exact JSON comparisons passed. Function definition hash d01b995dee57a93d3468e6e8b820ab4b matched expected; SECURITY INVOKER, empty search_path, jit off,16MB work_mem and20s timeout unchanged. Single post-deployment function calls (not medians/network timings): today1489.02,1W1450.08,1M1506.16,3M1923.46,6M1866.09,1Y2365.52,ALL2508.69ms. No production financial rows changed. Security advisor findings unchanged; health advisor empty.

Re-read main431713b immediately before guarded fast-forward to668b451. Pages42567339581 started for this exact SHA. Main CI42567340093 is a redundant rerun; the final application's full branch CI already passed. Pages and live version checks completed as recorded below. Resume the authenticated date-candidate repeated-scan hypothesis above; do not rerun discarded count aggregation or only recheck deployment state.

Pages42567339581 succeeded for668b451. Direct live fetches verified version.json, HTML build comment, runtime appBuild=2026-11-09-period-evidence-249 and service-worker shell2026110902-249. This completes the release; no physical iPhone/Face ID/native keyboard/PWA lifecycle claim. The additional handoff documentation stays on the existing work branch without triggering another application deployment.
