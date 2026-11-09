# Build258 — empty period item contract

Entry (2026-11-10 KST): main2fa3f64, work72540cf, live2026-11-10-realized-accumulation-257. Required exact-SHA CI42686945297 and Pages42689672329 successful; duplicate main CI42689673888 still running at entry. Continued existing work/performance-detail-render-234. No operational financial rows read or written.

## Reproduction and change

Followed Build257's recorded next hypothesis, not another cache/concurrency trial. Current stock function metadata MD5bd6efafe7122db36de430839eb327374 matches the stock function in build254_existing_periods.sql. For an empty TODAY period, resolved_totals has zero rows and jsonb_agg returns SQL NULL, overwriting the earlier empty array with JSON null. The realized function then calls jsonb_array_elements on that scalar and raises22023. Synthetic3 securities/90 transactions, latest holdings November9 and last sale November8 reproduces this; no financial source update is required.

One expression now coalesces only the zero-row item aggregate to an empty JSON array. Amount aggregates remain NULL, complete remains false when no candidates, missing-evidence rows stay present, pending sales stay unknown, upstream failures still throw. No catch, no zero-value fallback, no formulas/date/account/auth/currency/freshness/queue changes. Financial calculation versions and all previously deployed features remain unchanged. Only app/cache version markers change.

## Verification

tests/build258_empty_period_items.mjs:23 whole-stock-response comparisons across nine supported periods, empty/no holdings, nonempty incomplete rows, another/no user; the only permitted difference is items:null→[]. Pending sales remain settlement_pending with realized_local:null; NAV exceptions still propagate through stock and realized RPCs. Optimized realized plus new stock passed27 complete differential checks against original realized, covering official/pending/mixed-day/financial output and ledger preservation.

Full actual browser startup/auth/queue/render, Chromium390x844, unthrottled CPU,50ms intercepted transport, actual local PGlite realized and stock SQL, NAV explicitly stubbed, fixed2026-11-09. Five alternating pairs, identical warm SQL plans, reset app caches. Before:5/5 requests fail22023; error display median199.9ms (180.5–226.1). After:5/5 correct empty result and visible '내역 없음', median209.1ms (191.3–238.2). One realized RPC in every sample. **Failure latency is not time to correct result; this is a correctness/recovery fix, not a percentage speedup.** Raw performance/empty-period-browser258.json and local diagnostic performance/empty-period258.json. Empty state also checks390/402/430px and125% zoom for horizontal overflow. No production latency/iPhone claims.

Required CI includes the new SQL and actual-SQL browser paths for Chromium/WebKit plus existing full mobile/financial/wealth/detail/chart regressions. Local WebKit dependencies unavailable; CI remains gate. Exact final-SHA CI must pass before live migration/main promotion. Review migration filename20261109202318_normalize_empty_period_items.sql. Preserve deployed stock invoker/STABLE, search_path='', jit=off, work_mem16MB,20s timeout and ACL. Deployment must guard expected original body and verify resulting body and Pages markers. No migration history repair or bulk push.

## Next action

After the release gate, attribute the nested stock/NAV execution with the actual NAV SQL in isolated fixtures. Build257's scale benchmark explicitly excluded NAV; do not represent it as production end-to-end performance. No resurrecting rejected realized TTL caching or concurrency2 without new evidence. Preserve any new measurements and remaining hypothesis here before ending the run.
