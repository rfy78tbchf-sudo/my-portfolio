# Build252 — reuse corporate-event candidates within a period query

2026-11-09. Continue work/performance-detail-render-234 from53a7285, main ef316c3/live251. Verified latest main/work refs, completed CI/Pages and direct version.json. No active runs at start. This follows the recorded large-history gate; no repeat of the rejected opening-quantity optimization.

## Change and correctness
Materialize account-owned corporate-event candidates once per query rather than repeating their extraction for each asset. Preserve exact excluded types, verified-IPO evidence IDs, original asset keys, effective-date fallback, start boundary and cutoff. No cache, new requests, UI/function additions, ledger writes or cost reconstruction. Existing Build251 domestic/native reconciliation, Build245 estimates, fees/taxes, currency/account scope and annual-goal behavior remain unchanged.

Migration guard b08fe9c5e0bab487b0dc1a64aad25800 →6aa21954163a2e536cd1525d10bb69e5. Idempotent on the exact target only; drift raises. SECURITY INVOKER and existing settings preserved. The final migration was applied twice in synthetic regression. Domestic/native boundaries,29 rejection cases, owner isolation and seven other-period comparisons passed locally; final required CI explicitly runs that deployment file.

## Evidence
Dedicated CI42604526196/job129116966207 passed on c18eedd9: Build251 reconciliation with candidate, then300 positions/5100 synthetic transactions containing120 valid IPO groups and220 corporate-warning items, aliases, malformed receipts and boundary events. Seven-period full JSON equality. Sequential browsers (no concurrent local benchmark), Ubuntu24.04, Playwright1.55.1,390x844,no CPU throttle,100ms fixed synthetic transport,five alternating fresh pages per version/period. Each first result has one RPC; cached return has zero additional RPCs and equal output. The measurement ends after the result and two animation frames, includes PGlite execution and rendering, and is not production network or iPhone timing.

|Period|Chromium median before→after ms (ranges)|WebKit median before→after ms (ranges)|
|---|---|---|
|1W|812.8→725.2 (811.3–814.3 /722.2–726.2)|884→792 (880–964 /789–813)|
|1M|818.4→728.1 (815.1–824.5 /726.7–734.8)|904→814 (902–920 /811–816)|
|3M|847.0→756.5 (842.2–852.5 /750.6–763.0)|916→833 (910–919 /825–845)|
|ALL|1603.9→1383.6 (1597.0–1634.6 /1382.3–1395.1)|1684→1464 (1672–1692 /1454–1466)|

Fresh production-data comparison used complete deployed251 and candidate SQL bodies in authenticated repeatable-read/read-only transactions, jit=off/work_mem=16MB. All seven period JSON outputs identical. No data mutations. Five alternating EXPLAIN ANALYZE samples after result comparison, execution only:
-1W before413.076,426.692,437.337,473.955,442.254; after392.858,393.452,433.043,423.206,412.826ms. Medians437.337→412.826; ranges413.076–473.955 /392.858–433.043.
-ALL before1285.257,1290.757,1298.279,1459.636,1426.469; after991.747,1087.382,1029.930,1062.133,1108.890ms. Medians1298.279→1062.133; ranges1285.257–1459.636 /991.747–1108.890.

Small samples do not establish p95 or elimination of intermittent production delay. Memory peak, real network tail and physical iPhone unmeasured. Earlier100-position results are retained in docs/PERFORMANCE_AFTER_BUILD250.md; small-history improvements were modest and1M WebKit variance overlapped. Do not generalize large-history percentages to every user query.

## Release gate / next action
Pending: final application CI, apply exact tested252 migration, verify hash/attributes and unchanged aggregate coverage, fresh main lease, Pages success and live version/HTML/SW markers. Do not claim deployed until all pass. Preserve archived unshipped opening-quantity fixtures as experiments only.
After release, investigate non-home refresh waiting for full enrichment (refreshLive→loadLive(false)) with delayed synthetic unrelated reads. That is an unmeasured code hypothesis, not a proven bottleneck. Do not rerun the same corporate benchmark without new evidence. Keep result freshness, fee/tax/estimate distinctions and existing return/input behavior protected.
