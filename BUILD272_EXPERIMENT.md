# Build272 experiment — foreign evidence completeness

2026-11-10. Fresh main f506ef99a42bc1993eca6c82852149c94431235c and operating worker v86 were checked. No competing product branch was found. Build271 main CI 42790541830 has now completed successfully; exact-commit branch CI and Pages were already successful. Live version/index/sw were fetched and matched the product files byte for byte.

## Reproduction and candidates
Run from repository root:
- node tests/build272_foreign_evidence_experiment.mjs
- CANDIDATE=reject node tests/build272_foreign_evidence_experiment.mjs
- CANDIDATE=exclude node tests/build272_foreign_evidence_experiment.mjs

Actual worker code with synthetic complete overseas holdings and an integrated foreign row lacking effective/pending fields:
1. Baseline saves holding quantity 2, but evidence effective quantity 0 and pending quantities 0. These are absent fields converted through n(), not genuine explicit zeros.
2. Applying the domestic required-field guard to every foreign integrated row rejects the whole sync before storage, even though the separate detailed overseas response is usable. Rejected as an availability regression.
3. Excluding foreign integrated rows preserves holding quantity 2, but the actual settlement-basis SQL view still returns an older effective quantity 0 from previously stored evidence. Rejected as an incomplete fix.

PGlite executes the existing settlement view SQL; its fresh operating definition was checked and has the same unqualified latest-per-symbol selection. Other readers include lifecycle zero-position checks and ledger consistency checks, so this is not confined to the domestic bridge.

## Operating scope / no false completion
Fresh read-only aggregate examination did not find the specific positive-settled/zero-effective foreign pattern in stored evidence. This is a synthetic risk reproduction, not proof of an actual account misstatement. No broker endpoint was invoked and no financial record was changed. The newly linked v86 batch has not yet arrived. Today/week/month whole A/B and difference remain unverified. The latest NAV source version was re-read; financial values stay private.

No product changes or redeployment. Build271 / worker86 / UI marker266 remain. This branch contains only the reproduction and handoff. Security/performance/health advisories and post-deployment log-source aggregates were read; no unrelated advisory change was made. No browser UI was changed; this run does not claim new browser or physical iPhone validation.

## Concrete next work
Do not repeat the two rejected one-line candidates. Design explicit evidence completeness and source-batch identity for both new records and consumers:
- Missing foreign effective/pending fields must stay unknown; separate actual explicit zero from missing fields.
- A complete empty batch must supersede per-symbol stale rows without deleting history.
- Existing rows without raw-field completeness cannot automatically be promoted to confirmed.
- Test full sale, reacquisition, late response, complete-to-partial response, same symbol in differing currencies and historical lifecycle zero checks with independent literal expectations.
- Inspect normal source payload availability before selecting a legacy validity policy. Never backfill invented zeros or infer original-currency cash from KRW residuals.

