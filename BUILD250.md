# Build250 — share domestic execution-date evidence

## Starting point
2026-11-09: main668b451, existing work02a0bfa, live249. Pages42567339581 and application branch CI42566095785 passed; redundant main/documentation CI reruns were still running. No overlapping application change. Follow the authenticated date-candidate scan hypothesis committed in BUILD249.md.

## Cause and change
The old authenticated1W plan repeatedly scanned realized_pnl_events while matching individual/grouped ledger rows; raw ISIN/side/date expressions were also repeatedly evaluated. Three variants examined: owned evidence materialization alone, common source filters applied before materialization, and common projections calculated once. The first two left about1.3s SQL latency. The final variant materializes only the selected account's api/KRW/KB:SSQM2442 evidence and computes the exact existing trimmed ISIN/side and date-validation expressions once.

Both original match joins retain source, quantity, price, amount, date-window and cardinality checks. No financial formulas, inference, chronology rules, RLS policies, privilege changes, query range truncation or persistent cache. SECURITY INVOKER and function settings remain unchanged. Migration is hash guarded from d01b995dee57a93d3468e6e8b820ab4b to a1c5b0dd24c00467912fc425ce351892 and idempotent only for the exact expected target definition.

## Read-only production-data comparison
Complete SQL bodies under authenticated role, repeatable-read/read-only transaction, jit off/work_mem16MB; alternate before/after order, no cache flush. Times include planning/execution and RLS, exclude network/browser. Every pair returned exactly equal JSON. No financial values/identifiers are committed.

| Period | Runs | Before samples ms | After samples ms | Medians ms |
|---|---:|---|---|---|
| 1W | 5 | 1555.16,1481.40,1473.77,1472.82,1486.75 | 447.64,434.50,429.66,435.29,435.81 | 1481.40→435.29 |
| 1M | 3 | 1776.45,1585.31,1534.01 | 478.19,465.34,472.07 | 1585.31→472.07 |
| 3M | 3 | 1766.12,1678.77,1676.30 | 622.55,619.43,630.44 | 1678.77→622.55 |
| ALL | 3 | 2576.62,2355.73,2343.89 | 1290.89,1297.67,1282.72 | 2355.73→1290.89 |

An initial earlier control call took4210ms and was not a controlled cold-cache sample. Do not claim a p95 or cold-start improvement from these small samples. Final candidate1W plan: owned evidence built once (~4.9ms), its source scan loop1, individual date candidates~70.6ms, total execution573.83ms, no temp read/write blocks. Inclusive plan timings cannot be summed; peak process memory is unmeasured.

## Isolated regression and timing
PGlite0.3.14, fixed2026-11-09 clock, actual accounts/transactions/realized-event ownership RLS with authenticated role. Two users have matching synthetic evidence to catch cross-owner pollution. Five measured1W runs after warm-up, alternating versions:

| Transactions / evidence / positions | Before median (range) ms | After median (range) ms |
|---|---|---|
| 200 / 400 / 20 | 159.3 (158.4–160.6) | 48.0 (46.8–54.4) |
| 1000 / 2000 / 100 | 2915.9 (2891–2940) | 172.5 (167.8–196.5) |

Full JSON equality across seven periods and12 cumulative mutations: invalid dates, duplicate ambiguous evidence, manual/foreign/other-provider exclusions, explicit order dates, whitespace/missing ISIN, malformed gross, grouped split-ledger evidence, second user and absent owner. Assertions require recovered dates in the initial fixture, retained provisional dates for ambiguous matches, grouped recovery and ok=false for absent account. The actual migration is applied twice before testing.

Chromium390x844,1000 synthetic transactions/2000 evidence rows/100 positions, fixed100ms transport delay, no CPU throttle, three alternating fresh pages per version/period. Real period handler/RPC queue and renderer connect to the isolated authenticated SQL engine; elapsed time ends after two animation frames. Exactly one first RPC, zero additional cached-return RPC, identical JSON. This is not live network or physical iPhone timing.

| Period | Before first median (range) ms | After first median (range) ms | Cached before/after median ms |
|---|---|---|---|
| 1W | 3145.2 (3095.7–3277.7) | 323.6 (315.2–333.6) | 33.9 / 33.4 |
| 1M | 3141.6 (3076.3–3147.8) | 361.8 (336.5–372.8) | 46.9 / 35.3 |
| 3M | 3273.5 (3167–3460.3) | 442.6 (410.4–453.3) | 47.6 / 51.3 |
| ALL | 3317.1 (3166.2–3357.4) | 476.5 (474.9–487.6) | 47.2 / 52.0 |

Cached timing overlaps; no cached-speed improvement claim. No changed cache invalidation, cancellation, concurrency, UI or wealth features. Build72 update/version regression passed.

## Release gate and next action
Require final application commit's full Chromium/WebKit CI, existing390/402/430px and125% checks. Then apply committed guarded migration, read-only exact JSON comparison of deployed RPC against249, fresh-main guarded promotion, Pages and live version confirmation. Deployment is not yet claimed.

After release, profile ALL's remaining per-position corporate-event and pre-period quantity scans under authenticated role. Prioritize measured costs; do not repeat this evidence-normalization work or the rejected249 trade-count aggregation. Once major period costs are addressed, continue refresh/startup/tab/chart flows. Actual iPhone/network tail latency and peak memory remain unmeasured. No production financial rows written.
