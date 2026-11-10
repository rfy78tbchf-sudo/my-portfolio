# Build274 continuation

Product candidate: 86aed9879276ffcb847a28878eed356d94a62f0c on work/performance-allocation-cutoff-274. Baseline main: f506ef99a42bc1993eca6c82852149c94431235c. Do not promote until the exact product commit's required CI succeeds and a fresh main lease is checked. A later handoff commit is documentation/test-reproduction only, not the product tested by CI.

The product change is described in BUILD274.md. Local allocation, independent NAV contract, manifest and Chromium UI tests passed. Chromium covered 390/402/430px and 125% text enlargement, allocation controls, overflow and detail return. Local WebKit did not launch because system libraries were missing; that attempt is not a WebKit pass. Actual iPhone was not used.

Required run 42811722712: decision-regression succeeded. Mobile job 129814565716 is pending completion at browser dependency installation; no mobile browser tests have run in that job yet. Main/Pages have not been updated by this run. Baseline Pages manifest is 2026-11-10-settlement-evidence-266, repository implementation Build271 and operating worker v86.

Render-function microbenchmark, same synthetic data, Chromium 390x844, no throttling, 20 warmups and 50 alternating paired samples of 50 calls: 7 holdings median 0.008 -> 0.010 ms (ranges 0.004–0.012 / 0.008–0.030, p95 0.012 / 0.016); 100 holdings median 0.048 -> 0.082 ms (ranges 0.042–0.072 / 0.072–0.120, p95 0.056 / 0.102). Reproduce with tests/build274_allocation_bench.mjs. This measures HTML generation only, not network, paint, request-to-correct-result or iPhone speed. No speed improvement is claimed and no new request was introduced.

Normal collection advanced while CI ran. New position evidence is source-linked without account/time mismatch. This is new operating verification of Build271, not a Build274 change or proof of field completeness. Whole A/B remains unavailable. Today's settlement bridge remains incomplete; original settlement/execution coverage has not yet supplied the required future settlement evidence. Actual private amounts, counts and per-period before/after observations are excluded from this public file. End valuation time changed naturally, so the two observations must not be used as a before/after UI-effect comparison.

Next run: inspect the existing required run before starting anything new. If it succeeds, recheck main and fast-forward only the product candidate, then verify Pages SHA and exact version/index/sw bytes. If it fails, inspect the failed step and retry/fix only from concrete evidence. Do not bypass required CI or report deployment while it is pending.

Then resume the existing Build273 batch prototype on work/performance-evidence-batches-273, commit cdde34a9ca24c7b20a72c8ccfc79592ab30c7864. Integrate service authorization, source ownership, nullable field presence and all seven readers plus settlement view together. Preserve legacy evidence and avoid per-symbol fallback from an incomplete/latest empty batch. Do not implement another prototype or backfill historical completeness. Keep whole-account A/B, original-currency cash/FX and ISA opening coverage unresolved until independent evidence exists. The recurring task remains enabled.

## Deployment confirmed on 2026-11-10

Required CI 42811722712 completed successfully on product SHA 86aed9879276ffcb847a28878eed356d94a62f0c, including Chromium and WebKit. Fresh main lease was checked before fast-forwarding. Pages run 42817629079 succeeded on that same SHA. The operating worker remains v86 and its source matched the repository; no DB or worker changes were deployed. Today/week/month reconciliation responses before and after promotion were identical at the same valuation cutoff; whole A/B remains unavailable.

The pending-install statements above are historical. Build274 is now the product revision. The next batch work continues at ec5349996cbe10d2a419fcd0cfa11a2b513f080b on the existing Build273 branch; malformed typed quantities were rejected locally with fixed expectations, but production authorization and consumer integration are still unfinished. Actual iPhone remains untested. Keep the recurring task enabled.

Deployment verification: live version.json/index.html/sw.js were byte-identical to product SHA. Local Playwright public navigation returned ERR_EMPTY_RESPONSE; the cloud browser successfully opened the actual login screen and confirmed the DOM build274 marker. This is unauthenticated shell verification, not a logged-in financial journey or actual iPhone verification.
