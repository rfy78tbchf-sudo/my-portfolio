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

## Same-run NAV follow-up (no additional production change)

Captured only function definitions and column metadata for NAV, current/base account scope, external flow allocation and balance-date classification. Local fixture tests/fixtures/nav258.sql contains no operational rows or user-specific values. Actual deployed function body hashes were checked; nested NAV/scope/flow code now executes rather than being stubbed. experiments/nav-profile258.mjs adds367 daily synthetic snapshots/logs and0/30/300 synthetic cash flows with representative lookup indexes.3 securities/90 transactions remain the separate empty-period correctness fixture; this profile uses10/100 securities ×30 transactions. Five warmed repeated samples for each of4 periods ×2 trade sizes ×3 cash-flow sizes =120 samples; each sample measures all three entry points separately and asserts full-response equality to its scenario baseline. Durations nest and must not be added.

|3,000 transactions|NAV median ms (0 /30 /300 cash flows)|Stock median ms (0 /30 /300)|Realized median ms (0 /30 /300)|
|---|---|---|---|
|1W|5.4 /6.9 /49.9|153.8 /138.7 /198.9|447.3 /413.8 /512.0|
|1M|5.3 /6.1 /46.6|167.2 /146.9 /212.6|494.9 /423.9 /533.4|
|3M|4.6 /7.7 /49.7|169.6 /180.7 /221.1|481.8 /525.4 /545.6|
|ALL|4.8 /6.5 /50.7|308.7 /327.1 /363.5|730.1 /795.4 /774.9|

Raw performance/nav-profile258.json includes every sample and variation. These are successive scenarios, not randomized before/after optimizations. Current-scope observation/correction tables are empty; non-account fixture tables have simplified authorization, so this does not establish production RLS/I/O or large screenshot/history costs. Missing evidence remains unverified and whole_pnl stays null. No network, browser or production latency claim. NAV is not dominant for the0/30-flow scenarios;300 historical flows increase its cost, even for a recent empty flow interval. No speculative NAV cache or financial shortcut was deployed.

Operating gateway aggregate lookup restricted to four relevant RPC paths from2026-11-09T20:05:44Z through20:30:30Z returned no calls. Therefore no post-Build257 operating latency comparison can be made from this window. No raw URLs, headers, identities or financial payloads were retrieved/published. The initial source-count discovery used an end bound20:36:00Z ahead of the tool clock20:30:30Z; final relevant-RPC query used the exact current bound above.

Next bottleneck candidates (maximum3): (1) duplicate stock computation across selected total and realized requests: prototype request-local sharing within one server snapshot, preserving freshness and existing independent failure behavior; do not use the rejected cross-request TTL. (2) remaining realized ledger-loop work after Build257: attribute before changing formulas. (3) historical cash-flow classification cost only if representative larger-flow evidence justifies it. Normal NAV-only micro-optimization is deferred. Existing swing batch failure-path overhead remains unresolved and must not be silently reintroduced. Required release CI and verified deployment remain the immediate gate.

## Verified release (2026-11-10 KST)

Application SHA c3f04cb81f6c154d9e18a7a7c6f59c14d639eaaa passed required full CI42693003841 (mobile93 steps and decision-regression23 steps, both success). Fresh main2fa3f64 and workc3f04cb were checked before rollout. Other trust branch665992b is already an ancestor of main; no parallel unmerged trust work was overwritten. The existing automation remains enabled; its recorded active run began20:19:30Z, matching this execution.

Applied only reviewed normalize_empty_period_items through the connector with expected-original-function MD5 guard. Server migration version20261109204118; review file20261109202318_normalize_empty_period_items.sql. Do not repair or blindly push divergent local/server migration history. Post-apply stock function MD5a277ec6fa970b927be58c933eba5672e matches candidate; realized bodya0ebdce3dd5c47542b2f2d06a1e055cb remains unchanged. SECURITY INVOKER, STABLE, empty search_path, jit=off, work_mem16MB,20s timeout and existing postgres/authenticated/service_role execute ACL retained. No-session stock invocation still rejects authentication required. Security/performance/health advisor category/count summaries unchanged. No operational financial records read, generated, updated or deleted.

Rechecked main lease again after backend verification, then fast-forwarded main to testedc3f04cb. Pages42695429969 succeeded for the exact SHA at2026-11-09T20:42:38Z. HTTP verification of version.json/index.html/sw.js confirms2026-11-10-empty-period-items-258 and my-portfolio-shell-2026111004-258. Main-triggered duplicate CI42695432287 remains independent of the already successful exact-SHA release gate. This release fixes the empty-period error; it does not claim reduced successful-query latency or resolution of every intermittent operating delay. Physical iPhone/PWA lifecycle and operating end-to-end latency remain unmeasured.

Follow-up NAV experiment/source metadata fixture/raw120 samples and this release evidence are committed on the same work branch without another application modification or redeployment. Continue from the three concrete candidates above; the primary next hypothesis is duplicate stock computation with safe request-local, same-snapshot reuse. No additional cache/concurrency change has been made.
