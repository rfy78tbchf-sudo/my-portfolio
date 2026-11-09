# Build250 follow-up: corporate-event candidate experiment

2026-11-09. Existing branch work/performance-detail-render-234, starting work5653a9c; main47efd8e; live version2026-11-09-date-evidence-250. Pages42569911430 succeeded. No active Actions runs were present. Application CI42568658322 and documentation-head CI42570131399 passed. Redundant main CI42569912566 timed out in decision-save readback (locator.waitFor30000ms); this is not evidence of a calculation failure, nor proof the intermittent timeout is fixed.

## Candidate and scope
Followed BUILD250's remaining ALL corporate-event lookup hypothesis. The isolated candidate materializes account-owned non-trade corporate-event rows once, retaining the exact type exclusions, verified-IPO evidence exclusion, effective-date fallback and period boundaries. Existing financial formulas and account scopes are unchanged. No production DDL or financial-row writes were performed. The experiment is deliberately under tests/fixtures, not the deployment migration directory, and no app version/CI workflow was changed.

Reproduce: node tests/period_corporate_candidate_experiment.mjs. Optional BENCHMARK=1 PERIOD_BROWSER=1 UI_BROWSER=chromium uses the existing period250 browser harness. Baseline is the actual248 fixture plus249/250 patches. The candidate patch has baseline/target definition guards and is applied twice. Synthetic accounts/transactions/events have actual ownership RLS. Whole-result equality passed seven periods and16 cumulative variants, including ambiguous/grouped evidence, corporate events inside/before/after the period, excluded fee type, another owner and absent account. This is not yet a dedicated full-function IPO-boundary regression suite.

## Read-only production-data experiment
Authenticated role, repeatable-read/read-only, jit off, work_mem16MB. Complete SQL bodies; no network/render time. Every before/after JSON matched. Initial five ALL pairs had an after outlier2986.822ms versus before1514.631ms; no claim of eliminating intermittent latency. Follow-up12 pairs alternated which version ran first; all12 candidate calls were faster:

- Before ms:1541.814,1337.335,1337.265,1258.749,1253.161,1255.459,1253.446,1257.630,1257.712,1255.285,1255.153,1271.546.
- After ms:1006.113,981.586,1000.559,981.206,968.796,969.593,969.156,971.909,969.527,967.765,965.436,970.226.
- Medians1257.671→969.910ms; ranges1253.161–1541.814 and965.436–1006.113ms. This is warm SQL evidence, not p95/cold-start or real-device timing.

## Browser result and release decision
Chromium390x844,1000 synthetic transactions/2000 evidence rows/100 positions,100ms transport, no CPU throttle; three alternating fresh pages/version/period. Exact JSON, one initial RPC and zero extra cached-return RPCs retained.

| Period | Before median/range ms | After median/range ms |
|---|---|---|
| 1W |339.7 /326.4–349.1|313.6 /312.3–314.9|
| 1M |345.0 /341.0–377.7|320.7 /320.3–322.7|
| 3M |427.3 /417.6–464.4|425.4 /406.4–437.8|
| ALL |482.9 /478.6–486.1|475.2 /454.4–498.6|

The targeted ALL first-result improvement is only7.7ms in this fixture and ranges overlap. ALL cached medians55.1→66.4ms also have overlapping ranges; cache implementation was unchanged, and a cache-speed improvement is not claimed. SQL-only evidence is promising but the current synthetic shape does not establish a material end-to-end ALL benefit or a tail-latency improvement. Do not ship this experiment as Build251 yet. No WebKit/release gate or new Pages deployment is claimed. Build250 remains production.

## Concrete next actions
1. Add a representative corporate-event/IPO/alias-history synthetic cohort and direct full-function assertions for valid IPO exclusion, malformed IPO retention and opening-boundary events; test both browsers before deciding whether to ship this candidate. Do not repeat the unchanged simple buy/sell benchmark as the only evidence.
2. Independently evaluate BUILD250's pre-period quantity-validation scan (~242ms in its prior ALL plan) using grouped original asset keys, retaining null/zero semantics and chronology. Compare separately and combined, at most three candidates per run.
3. Check the decision-save timeout at its exact readback wait if it recurs; do not weaken timeouts/assertions simply to green CI. Keep existing correctness,390/402/430px and125% gates for any release.

Peak memory, physical iPhone and production network tail remain unmeasured. No source financial identifiers, quantities, balances or user memos are recorded here.

## Follow-up: full IPO regression and opening-quantity candidate
2026-11-09 subsequent run: main47efd8e and live250 unchanged; work4cc866c CI42574825276 passed, no active Actions runs. Read the deployed function again before constructing the candidate. No production migration was applied.

Added tests/period_corporate_ipo_regression.mjs: full baseline/corporate-candidate JSON equality for seven periods over valid IPO, malformed IPO cash, prior-boundary receipt and future receipt fixtures. Direct intermediate assertions prove valid IPO evidence is excluded from corporate warnings, malformed evidence is retained, and prior/future receipts are outside the1W boundary. All passed. An initial fixture expectation incorrectly assumed future receipt removes unmatched payment/refund corporate rows; corrected the fixture to isolate receipt boundaries by removing those rows. Production code was not changed to satisfy a faulty expectation.

Independently implemented tests/fixtures/period_opening_quantity_experiment.sql, applied once to the exact250 definition in tests/period_opening_quantity_experiment.mjs. It groups the original signed quantity expression by original asset key before the shared start_date, retaining coalesce-to-zero for absent/all-null totals. It does not synthesize opening cost. Seven-period whole-result equality and14 evidence/ownership mutations passed. Actual account/transaction RLS with authenticated role is applied around each RPC; benchmark durations include identical role-switch overhead in both versions.

Read-only production SQL, authenticated repeatable-read, jit off/work_mem16MB, five alternating-order pairs, exact JSON equality:
- ALL before1471.725,1321.824,1305.686,1335.781,1285.161ms; after1099.252,1097.348,1063.541,1070.718,1064.246ms. Median1321.824→1070.718ms.
- 1W first baseline1942.494ms is an uncontrolled initial-call outlier. Remaining before432.057,431.015,429.238,431.068; after439.170,432.067,431.219,435.494ms show no1W improvement. First candidate457.501ms. Do not claim cold-start/p95 improvement.

Isolated PGlite synthetic ALL comparison, five measured samples after warm-up, alternating versions; fixed2026-11-09 clock and no network:
| Transactions / positions | Baseline median (range) ms | Candidate median (range) ms |
|---|---|---|
|600 /20|72.7 (62.6–82.8)|72.7 (63.8–78.0)|
|3000 /100|311.9 (299.5–346.3)|317.9 (309.8–333.0)|
|6000 /200|984.2 (964.1–1018.6)|975.8 (963.1–1115.7)|

This falsifies a material general scaling benefit for the tested trade-history shape. The production SQL gain alone does not justify shipping this candidate. Keep it isolated in tests; no Build251 release or UI change. Earlier non-RLS exploratory samples are not used as the final SQL comparison.

WebKit binaries downloaded, but local OS dependencies were missing; package installation failed due environment setgroups/cache-directory permissions. No successful local WebKit check is claimed. Existing250 CI success remains separate from these new experiments. Do not disable browser checks or weaken release gates. A release-worthy candidate must pass both browsers in the existing CI environment.

Next: retain the now-tested corporate/IPO exclusion logic and measure a mixed corporate/IPO/alias history cohort (the full-function correctness fixture is small, not a performance cohort). Do not repeatedly benchmark the rejected opening-quantity aggregation on the same simple trade shape. If no end-to-end benefit survives, proceed to refresh/startup request paths using recorded browser evidence. The opening-quantity and corporate experiments are not combined or deployed.

Authenticated Chromium390x844,3000 transactions/100 positions,100ms synthetic transport,three alternating fresh pages/version/period; identical JSON,one initial RPC and zero extra cached-return RPCs. No CPU throttle; this is not production network timing.

| Period | Before median/range ms | After median/range ms |
|---|---|---|
|1W|368.6 /363.0–393.4|357.1 /351.5–362.3|
|1M|370.4 /363.6–375.4|365.7 /352.5–388.0|
|3M|382.3 /374.4–423.3|380.7 /363.7–463.8|
|ALL|508.3 /498.7–510.4|519.4 /474.7–536.2|

## Post251 mixed-history investigation (2026-11-09)
Authoritative main is ef316c3 (Build251), work starts eb3cae4. Main CI42592253890, Pages42592253327 and live marker probe42592445527 passed; direct version.json also reports251. Earlier paragraphs referring to250 describe earlier experiments, not current production. No active Actions run was present at start. Preserved the local uncommitted251 timing note outside the checkout before fast-forwarding to the committed release handoff.

Added tests/period_mixed_corporate_experiment.mjs, based on the complete251 function and the existing isolated corporate-candidate replacement. No production SQL or app change. Fixture:100 positions,1699 transactions, valid/malformed IPO receipts, historical paired trades, alternate A-prefixed security keys and prior/current/future transfer events. Direct intermediate checks find40 valid IPO groups and74 corporate-warning items. First fixture draft gave every IPO position a pre-IPO trade and therefore correctly yielded no valid IPOs; changed only the synthetic cohort to include genuine first-acquisition IPOs. Seven-period complete JSON equality passed; five measured alternating SQL pairs after warm-up.

Local Chromium390x844, no CPU throttle,100ms fixed synthetic transport, three alternating fresh pages per version/period. First RPC-to-render medians/ranges(ms):1W313.7(300.6–341.6)→304.1(299.0–306.4);1M312.9(299.6–313.9)→312.4(293.5–313.3);3M321.0(309.5–331.3)→311.7(295.9–321.8);ALL416.7(408.7–440.7)→396.4(383.6–411.0). Identical results, one initial RPC and zero additional cached-return RPCs. Existing helper metadata incorrectly hardcoded1000 transactions; actual SQL count is1699. Fixed reporting to use actual counts without changing measurement behavior. No p95/production-network/physical-iPhone claim.

Local WebKit lacks OS shared libraries; use the existing Ubuntu24.04 CI installation route, not weakened tests. A dedicated mixed-history workflow runs both browsers and a300-position larger cohort. CI/large-cohort results pending. The current overlapping browser ranges do not justify production deployment. Next: use those results to close this corporate-candidate hypothesis; if benefit remains inconclusive, inspect refresh/startup request paths instead of repeating the same SQL experiment. Preserve Build251 reconciliation and estimated/confirmed regressions.
