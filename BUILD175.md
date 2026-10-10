# Build175 — Open the detail without waiting for account-scope metrics

Baseline: main 7e5fbaa9acf60cefccbfa832ead93667376e09ca. The deployed GitHub Pages index and repository index had identical SHA-256 08891ca834a8b9d461e329c849352b866a65f3b13b1790c31cc2facb5699a5e7. The two old Sites projects are not the current GitHub Pages deployment. Production browser inspection reached the login screen, without an authenticated owner session.

## Three observed obstacles

1. Incomplete: opening a holding waited for five RPC results, including optional account-scope scenario metrics. This unnecessary dependency delayed viewing and recording a decision when metrics was slow. It is now removed: four existing core requests render the detail, then metrics updates only its own field. A failed or invalid metrics response shows a dash and a local retry. Closed/superseded details and newer comparison results reject late responses.
2. Incomplete: moving between holdings or closing with unsaved edits requires discarding the draft or staying. Existing scoped dirty-state and late-save protections remain. Cross-navigation draft retention is the next priority; it is not claimed complete here.
3. Error: login displayed a hardcoded build 85 despite the current build. Removed the obsolete number; the existing actual build marker/update check remains and the shell cache advances.

## Validation and limits

- 74 targeted isolated assertions passed (detail readiness, scoped weight, comparison reset, editing, immutable verified save/readback and late-response protection).
- Existing detail dirty-state and resume/scroll suites passed.
- Extended the existing 390/402/430px mobile first-decision scenario: keep metrics unresolved, open the form from home with optional tools closed, save/read back exactly one synthetic judgment, then release failed metrics and verify local retry. This fixture never uses a real account or sends an actual trade, decision or AI request. CI result must be checked separately.
- Real-account authenticated flow, iPhone Face ID/PWA return, first-load/return/refresh/period-switch timings, financial reconciliation, and the 30-second/one-minute usability targets remain **confirmation needed**. This change removes one dependency; it does not claim all detail requests or daily access are fast.

No database, transaction, financial formula, account scope, authentication, or AI behavior is changed. Existing completed work is retained.
