# Build249 — period evidence evaluation

## Starting point and scope
2026-11-09: main431713b / work7f7fdc3, frontend248, successful CI42554613496/42557205372 and Pages42554612628. Continue the same work/performance-detail-render-234 branch. Follow the next hypothesis in docs/PERIOD_LATENCY248_BASELINE.md, not a repeat of the queue fix. No production financial rows are written.

## Measured cause and selected changes
Current full SQL repeatedly evaluates correlated evidence expressions after the planner expands the evidence CTE into multiple classification/calculation expressions. Materialize that per-position evidence once within the RPC's statement snapshot. This is not a persistent cache: account ownership, period, date/FX evidence and freshness remain unchanged. Work_mem remains16MB.

The ALL path also repeatedly counts bounded-period membership matches even though domestic_period_membership explicitly excludes ALL. Skip that diagnostic count only for ALL. This does not set any missing P&L to zero. Bounded-period membership logic is unchanged.

Three candidates examined: (1) preaggregate four history trade counts; synthetic benefit, but production alternating runs overlapped (median2266.84→2247.35ms), so rejected; (2) evidence materialization, selected; (3) skip empty ALL membership count, selected after additional repeatable benefit. No query range truncation, new UI, concurrency increase or calculation formula change.

## Production read-only comparison
Five alternating before/after executions of complete SQL bodies, same read-only transaction/snapshot, jit off, work_mem16MB. Includes dynamic SQL planning and execution, excludes network/browser; not a controlled cold cache or production RPC before/after deployment measurement. Exact JSON equality passed each run. No financial values or identifiers retained.

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

Pending final CI: both Chromium and WebKit, standard390/402/430px and125% display regression suite, update/version checks and existing queue/finance/wealth tests. Migration is definition-hash guarded; drift must stop deployment. Apply only the committed verified SQL, re-read definition and compare current RPC JSON with baseline in a read-only transaction, then guarded main promotion and Pages/version verification. Deployment is not yet claimed.

## Next hypothesis
After verified deployment, inspect remaining repeated pre-period quantity checks in closed_cycles and per-row FX lookups; use a new plan and isolated scaling comparison before editing. Do not resurrect the rejected history-count-only change or add persistent caches without freshness evidence. Refresh/startup/tab/chart work follows the remaining major period bottlenecks. Actual mobile network/physical iPhone tails and process memory are not measured by this pass.
