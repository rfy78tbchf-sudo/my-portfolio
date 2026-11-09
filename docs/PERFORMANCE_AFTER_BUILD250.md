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
