# Build178 — Understand saved decisions from home

Baseline: 1b0bbf98468a464ae864c4071403b23940118b0a. GitHub Pages source matched Build177 SHA-256 303ed8bfd4b94645e2f84a7da5b3677f2a22d2a477cf3524c24da70c5be76ee9 before editing.

## Incomplete flow addressed

Home showed the saved choice and a status but omitted its reason, did not put the price threshold beside the observed close, and gave the same collapsed heading for manual conditions, missing data and automatic non-hits. These were code-confirmed usability gaps; authenticated owner-account operation was not directly observed in this iteration.

The existing home review card now shows the owner's reason and checkpoint, and a validated close in its own currency with the observation date. Two-line reason/condition previews keep the card compact; the existing direct detail route opens the complete saved judgment. The collapsed summary distinguishes reached conditions/new evidence, manual review, missing data/conditions, and no matched automatic condition. This is bounded to saved conditions and stored observations, never a portfolio-wide claim that nothing changed or a sell recommendation.

The existing priority ordering, one leading item, expandable remaining holdings, automatic condition calculations, decision storage and account balances remain unchanged. No new service or maintenance task is required.

## Validation

New isolated checks cover reason/condition visibility, close and date, null quotes, manual/unknown/non-hit separation, HTML escaping and holding scope. Existing home/detail parity, 70 manual-condition tests, official-evidence, bounded review-list and script/sync checks passed. Synthetic mobile tests extend the home → saved detail → home route at 390/402/430px and check calm and missing-data summaries. Full mobile CI and deployment succeeded; details below.

## Remaining priority

Actual authenticated iPhone completion remains 확인 필요. Repeated reminders after reviewing the same reached condition and persisted acknowledgement/defer behavior need a separate review; no acknowledgement is inferred from opening a card. Daily 30-second/one-minute timing targets remain unmeasured. Next priority: meaningful repeat-visit review handling without repeatedly demanding the same work.

## Final verification — 2026-10-10

- Production commit 8607f3b0c948997c25eb839304332a0574e809c2.
- Pages run 38048960063 succeeded. Deployed index matched SHA-256 41e37e22d73f0cc301be73a30fdbf1e43506e47d348fef09efe331634959920d.
- Full Mobile portfolio layout run 38048960471 / job 114204048246 succeeded. Artifact 11668927304.
- Browser assertions passed at 390/402/430px: collapsed non-hit summary, displayed reason/condition/close/date, same saved judgment in detail, return to home, missing-data status and manual-review count.
- Visually reviewed 390px home-decision-context and due/manual review screenshots: readable wrapping and no horizontal overflow; primary detail action visible. Test values are synthetic, not the owner's present holdings.
- Actual authenticated iPhone/PWA daily use remains 확인 필요, distinct from automated mobile verification. Completion of this scoped UI change does not imply every daily-review scenario is complete.
