# Build241 deployment handoff and next trust investigation

Code change: bind already-persisted, independently matched domestic broker trade dates to realized-sale selection/replay. Authenticated account scope and stored financial rows remain unchanged. Synthetic RPC/guard/browser regression is in the main release files.

Next independent source investigation: official KB public specification downloaded on 2026-10-31 from https://openapi.kbsec.com/api/kbs/guide/excel/b2c and https://openapi.kbsec.com/api/kbs/guide/json/b2c . The JSON endpoint returns a ZIP, the Excel endpoint an XLSX. SPQM2103 accepts ordr_dt, ccls_clsf=2 (filled; 1=all,3=unfilled), dl_clsf=0 (all normal/fractional), nxt_key. Record1 includes is_cd, crncy_cd, dl_clsf_nm, ccls_q_p6, frgn_ccls_prc_p6, ordr_ttm, ccls_ttm, ordr_no, orgn_ordr_no. Excel calls ccls_ttm execution time; no timezone, multiple-fill or first/last-fill guarantee found. SPQM2204 has order time rather than ccls_ttm; do not use it as execution time. API order number and ledger sequence are not execution-order proof.

Next safe action: add a bounded authenticated read-only diagnostic for SPQM2103, date+symbol scoped, complete pagination required. Return only fields needed to reconcile trade totals and timestamp coverage, never credentials, account references or person names. Test full/partial/cancel/correction/blank/tied/cross-midnight timestamps, duplicate pages and incomplete pagination. No finance ledger writes. Compare live evidence privately to settled SPQM2205/SWQA2301 records. Even if the feed returns timestamps, do not resolve mixed-day costs until its time semantics and exhaustive one-to-one or provably invariant grouping are established. Failure/empty result must remain unknown, never zero or a fabricated chronology.

A separate refresh candidate remains: explicit refresh currently uses TTL-gated history after the balance finishes. Existing build142 tests reproduce the skip within TTL. Measure recent-trade arrival + concurrent refresh + failure first; preserve request sharing, stale labels and fast home asset display. Do not issue broad month backfills on every render.


Release evidence (2026-10-31 UTC):

- App/SQL final commit: 0768c30bfb076fccd702b377e853f5dd5b34120b. Required branch CI run 41156642527 completed successfully, including decision regression and Chromium/WebKit mobile suite, before main advanced.
- Main was rechecked at 5b293a4855c6c2a249f2a0553f90ef67e14ea2b2, then advanced with an expected-SHA guard and no force to the validated commit. Live main recheck matched that final commit.
- Supabase migration build241_realized_trade_dates succeeded after an atomic current-function fingerprint guard. Authenticated owner-scoped read-only verification returned realized-sales-v9-evidence-dates. Selected-period membership matched the recovered broker dates. Foreign-sale and closed-cycle fingerprints were unchanged. No financial rows were written; private ledger values are not included here.
- Pages run 41157472430 completed build/report/deploy successfully. Live version.json and index.html returned HTTP200 with 2026-10-31-realized-dates-241; sw.js returned HTTP200 with my-portfolio-shell-2026103102-241, using no-cache requests.
- Main-triggered duplicate CI run 41157473071 was still running when this handoff was written; its decision-regression job passed. The identical final SHA already passed required pre-merge CI above. Recheck this run before the next code cycle.
- Physical iPhone Face ID, native keyboard and complete PWA restart remain unverified. Synthetic SQL timing is a correctness-cost measurement only, not a production latency claim.

Next execution: read latest main, this handoff and active branch/CI first. Continue this branch; do not create a duplicate. Prioritize the bounded SPQM2103 read-only evidence diagnostic above, then the explicit-refresh history TTL reproduction. Retain real unknown-order and amount/source-review states until independent evidence resolves them.
