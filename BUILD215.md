# Build215 — Display confirmed assets before the full account bundle

Base: Build214 `e3134bc6eb8d3ac41936163115278326841fba04`.
Build: `2026-10-21-fast-assets-215`.

## Behavior

- Start existing account-scope and active-account reads first, with the expensive holding valuation read in the third available slot. Reuse all three promises in the existing eight-read core bundle: no duplicate DB/API request.
- Once active accounts and a valid positive scoped total are confirmed, show that amount immediately on home. Preserve already-visible trend/composition with an explicit previous-data notice while the remaining account reads finish. Initial startup without cached data shows no invented holdings or chart.
- This fast amount is presentation-only, transient and owner/load-generation guarded. Never use it in decisions or performance calculations, or persist it as a complete snapshot. Missing/invalid/zero values fall back to the existing full-load behavior.
- Core failure clears the fast amount and restores the previous coherent account bundle with the existing retry. Late reads after failure or a different login cannot republish it. Partial readiness does not release the refresh lock or report the whole operation as complete.
- Home startup calculations still follow cash-flow reconciliation and saved-period restoration. Enrichment starts after the home startup bundle, preserving all current analytical functionality and existing save/readback, epoch, date and input guards.
- Refresh accessibility/status text distinguishes assets, holdings/trend and auxiliary work. Existing on-device cached summary remains available on reopening.
- No DB schema, authorization, calculation, KB order or account record changes. Frontend request scheduling only. No real-account test writes.

## Controlled timing comparison

Three runs each, median milliseconds, same production queue/load functions and synthetic fixture. Each ordinary read waits 40ms, holding valuation 180ms and reconciliation 250ms. This is **not** a live KB/API benchmark or a physical iPhone result.

| Milestone | Build214 | Build215 |
|---|---:|---:|
| Confirmed asset visible | 224 | 43 |
| Trend available | 557 | 515 |
| Entire load complete | 922 | 921 |

The gain is time to useful information, not a claimed reduction in KB response time or total processing. First trial delayed the valuation request; measurements caught the regression and its request was moved into the first three slots. `tests/build215_latency.mjs` reproduces the scenario with `PORTFOLIO_HTML` allowing the baseline source.

## Verification

`build215_startup`: missing values, single-query reuse, partial display, old-owner exclusion, late response after failed core, deferred enrichment and invalidation.
`build215_browser`: real startup/session/request queue with isolated synthetic network; Chromium/WebKit at 390/402/430; pending holdings, early amount, previous-chart notice, refresh lock, failure rollback and retry.
Existing full mobile, period, input, draft, exact save/readback/retry and resume regression workflow retained. Performance branches run the same gates before promotion to main. See final GitHub Actions results.

Actual iPhone Face ID, native keyboard, home-screen reopening and live KB/network timing remain physical-device checks.
