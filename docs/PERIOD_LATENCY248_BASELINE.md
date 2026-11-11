# Period first-query baseline — 2026-11-09

## Verified starting point
Main431713b, existing workd972a6e, live frontend248. Main CI42554613496, work CI42554746051 and Pages42554612628 succeeded. No overlapping work change found. No application/migration change or redeployment in this measurement pass.

## Production server read-only measurements
One initial1W function call took2158.56ms. Three later sequential calls per period (milliseconds):

| Period | Samples | Median |
|---|---|---|
| 1W | 682.36,510.37,619.22 | 619.22 |
| 1M | 663.97,621.13,602.39 | 621.13 |
| 3M | 1127.89,1012.63,931.93 | 1012.63 |
| ALL | 2580.78,2436.50,2360.14 | 2436.50 |

Each call used a read-only transaction, selected existing account ownership internally, 25s outer timeout and clock_timestamp around the function. Only duration and result hashes returned; no balances/quantities/account identifiers committed. These exclude connector/network/browser time. DB caches were not flushed: initial call is not a controlled cold-cache benchmark. Three samples cannot support p95/p99 claims. Cumulative PostgREST period-query statistics:304 calls, mean2325.70ms, maximum15288.90ms; accumulation window unknown, not this deployment's before/after result.

Read-only EXPLAIN ANALYZE of the current SQL body with literal period, jit off/work_mem16MB:1W execution531.151ms/planning46.057ms; ALL2535.113ms/54.369ms. These are diagnostic plans, not replacements for API function timings. ALL has repeated materialized dated_transactions scans (multiple nodes with101–222 loops and roughly219–303ms inclusive each). CTE producer time can be charged to consumers, so summing these or interpreting a CTE scan as pure self-time is invalid. The original hypothesis of a generic-plan-only slowdown is unproven: warm1W function timing approaches the literal plan. Prioritize repeated transaction lookup work in ALL instead.

## Synthetic browser baseline
`UI_BROWSER=chromium node tests/build248_period_baseline.mjs`: actual period renderer/RPC queues,390x844, fixed100ms synthetic service delay, no CPU throttle, three fresh pages per period/output-size pair. Measures request start through two animation frames. Ten/100 synthetic unknown-basis output rows exercise rendering; they are NOT transaction-history scaling or production finance records.

| Period | Rows | First median (range) ms | Cached return median (range) ms |
|---|---:|---|---|
| 1W | 10 | 140.4 (134.5–152.7) | 20.4 (19–31.5) |
| 1W | 100 | 210.8 (199.8–218.4) | 81.1 (69–92.7) |
| 1M | 10 | 139.9 (133–142.2) | 25.2 (17–29.9) |
| 1M | 100 | 217.7 (206.1–219.3) | 72 (64.3–79.7) |
| 3M | 10 | 139.2 (136.5–139.7) | 20.1 (18.5–22.6) |
| 3M | 100 | 222.4 (216.3–222.9) | 70.4 (65.1–73.7) |
| ALL | 10 | 135.4 (129.6–141.8) | 23.2 (17.8–28.8) |
| ALL | 100 | 198.8 (191.9–199) | 60.5 (55.7–64.8) |

All first requests issue one RPC; cached same-snapshot returns issue zero and preserve period/partial result. Warm return is invoked directly through the production handler, not a measured physical tap. WebKit/local OS dependencies and physical iPhone remain outside this pass; prior release's two-engine regression remains valid. This is baseline evidence, not a speed improvement claim.

## Next actions
1. Reproduce ALL transaction lookup scaling in isolated synthetic Postgres, using the current complete SQL definition and original date-reconciliation/foreign/IPO/corporate/distribution cases. Compare exact JSON results before considering pre-aggregation or a restricted key lookup.
2. Identify individual repeated CTE subplans and indexes; preserve full-history basis and dated evidence. Do not truncate history to speed period queries or promote estimates.
3. If a change shows material repeatable benefit, add regression tests and follow existing branch CI/main/Pages gates. Otherwise keep248. Do not redo the248 stale-queue fix or report unchanged status.
