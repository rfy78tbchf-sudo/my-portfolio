# Build226 — annual wealth goals and monthly actuals

The former Analysis tab now opens **자산관리**. Existing technical/risk analysis remains available in a collapsed section; its open state survives its own controls and detail return.

- STD 20% and BEST 30% use an explicitly confirmed previous December 31 baseline. Amount targets are baseline × 1.2/1.3. Actual growth amount/rate use the latest recorded month, including external flows. Achievement means actual increase / target increase, not total wealth / target wealth. Negative and >100% values remain visible; only bar lengths are bounded.
- One user-owned record per year/month with actual observation date. Users can import the current all-account app total into a matching month, include assets outside the app by editing it, or backfill past amounts. No current balance is relabelled as a historical month. No fabricated year-opening baseline. A prior December 31 record is available for explicit carry-forward. Missing months remain missing and later months win chronologically even after editing an older record.
- The chart plots saved amounts and horizontal year-end targets. All monthly amounts and cumulative growth rates are available in the monthly disclosure. Baseline/formula explanations are collapsed after setup.
- TOP3 is on-demand current-year YTD stock P&L, ordered by absolute amount so losses are not hidden. Source dates, KB stock scope, partial coverage, and estimated amounts remain visible. This is a separate latest stock attribution, not historical monthly attribution or a reconciliation of total-wealth growth; past-year attribution is unavailable. No extra P&L reads occur until requested.
- Monthly recording is an explicit user save; this build does not create an automatic month-end schedule. A saved month can be corrected without accumulating duplicates.

## Persistence and authorization

`wealth_growth.sql` adds two security-invoker RPCs to the existing per-user app_settings storage. Ownership RLS is unchanged. Anonymous execution is revoked. User ID is always derived from auth.uid(). Saves validate year, month, date, whole-won bounds and a positive baseline. A locked row plus expected revision prevents cross-device lost updates; identical retries acknowledge the existing record. Browser inputs survive failure/conflict and writes are disabled while pending. State is cleared on auth epoch change.

The additive migration `wealth_growth_monthly_records` was applied to the existing project. No real user's baseline or monthly amount was inserted. Synthetic SQL tests rolled back in full. Security advisor reported no findings for the new functions or storage; existing unrelated notices were unchanged.

## Validation

- Arithmetic: missing/zero, negative growth, >100% achievement, absolute TOP3 and auth-epoch isolation passed.
- Database rollback fixture: read/write, duplicate retry, correction, stale revision, zero/negative/NaN/fraction/future/wrong-month rejection, exact year-end carry-forward and two-user RLS isolation passed.
- Chromium: 390/402/430px at 100% and 125%, baseline save, import current amount, monthly save/edit, failure/retry, state reload, conflict recovery, past date rejection, chronological latest month, year switch and TOP3 passed. Korean screenshots inspected.
- Saved-decision and navigation Node regression: 127 passed. Full Chromium UI regression also passed, including existing analysis allocation controls and all five screens.
- CI includes both new Node and Chromium/WebKit tests plus existing full regression. Local WebKit cannot launch due to missing host libraries; remote WebKit and final workflow results are required before promotion.

Build markers: 2026-10-28-wealth-growth-226 / 2026102805-226.
Actual iPhone keyboard, Face ID and PWA lifecycle testing remains separate.
