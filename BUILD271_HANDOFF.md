# Build271 verified handoff

Product commit: f506ef99a42bc1993eca6c82852149c94431235c.
Branch: work/performance-position-binding-271.
Fresh main lease was f35997c061362d462d58feec2cc86bee47d9ed6f; fast-forwarded only after required exact-commit CI 42787782282 succeeded (decision-regression 26 steps; mobile 100 steps). Main rerun 42790541830 was still running at deployment verification; it is a duplicate of the tested product commit.

## Deployed and independently verified
- Migration bind_position_evidence_to_observation_271 applied. Read-back function body matches candidate. Execute permission: anon=false, authenticated=false, service_role=true.
- kb-sync-worker v86 ACTIVE, fetched source equals committed source. Existing custom authentication preserved. OPTIONS 204, unauthenticated POST 401; no broker refresh invoked.
- Pages 42790541490 succeeded for the product commit. Live version.json, index.html, sw.js HTTP 200 and byte-equal to this commit. This is a server-side correction: UI marker remains 2026-11-10-settlement-evidence-266 and shell 2026111013-266 intentionally.
- Old actual SQL reproduces a delayed older quantity winning latest selection. Candidate preserves latest quantity 2 and historical fractional .5 under different source timestamps. Identical retry leaves two rows. Wrong owner, absent source request, duplicate symbol, conflicting retry and incomplete quantities reject.
- Build270 malformed response guards, Build266 settlement bridge, Build254 independent arithmetic, Build269 cash binding, Chromium mobile widths/zoom and full Chromium/WebKit CI passed. Real signed-in iPhone, Face ID, native keyboard and PWA termination were not tested.

## Operating evidence and limits
Today, week and month were read before/after; normal collection advanced the closing observation during CI, before v86 deployment. Those changed amounts are NOT a code-effect comparison. Two post-deployment reads at the same source version matched. Whole-account A, independent B and difference remain unverified; no gap is patched and no financial history is rewritten.
No newly linked position rows existed at the post-deployment check; normal v86 collection is pending. Do not claim its first real batch succeeded. Existing rows are intentionally not backfilled. Actual financial values and source times are private.

## Next actions, in order
1. On normal collection, verify v86 rows link to the exact source NAV observation and cash evidence. Preserve the broker-call restriction. Implement/test full response batch coverage (including legitimate empty batches) before any consumer treats per-symbol latest rows as a complete position set. The current settlement bridge intentionally retains valuation_time_verified=false.
2. Foreign-row missing-field normalization remains a separate risk: domestic validation skips non-KRW detail rows, but position evidence currently maps all Record1 rows. Inspect available normal response evidence and add independent malformed foreign-row tests before choosing exclusion versus validated storage. Original-currency cash/FX and ISA historical opening evidence remain unavailable; do not infer them from KRW residuals.
3. Allocation code only checks finite positive denominator and known<=total before total-asset mode; this does not establish a shared valuation time. A source-version/timestamp fixture is required before changing that gate. Current differing-time allocation is explicitly a reference value, not a proven cash balance.

Automation stays enabled: overall integrity completion conditions are not met. Read current main, branches, CI, Pages and operating source before the next change.
