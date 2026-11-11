# Build186 — Put triggered judgment reviews next to total assets

Baseline: 7ceaa0d6fe27bab7b49ea031bbf2dfc47cf36dd2 (Build185).

## Scope

Verified in the current home renderer: triggered saved judgments followed today performance and shortcut navigation. Move the existing triggered-review section immediately after total assets. Keep its saved reason, condition, detail route, acknowledgment and undo controls. Quiet/manual/pending-only reviews retain their existing lower collapsed position. No new summary card, trading suggestion, data read or calculation is introduced.

## Verification

Mobile fixture adds first-screen geometry and section-order checks at 390/402/430px, plus a top-of-home screenshot. Existing acknowledgment, revisit, new evidence, judgment detail/draft/save and startup failure/retry scenarios remain in the full suite.

Validation completed:
- Full Mobile portfolio layout run 38062340984 succeeded (commit aace01db3e1b1b45e4a332ac14b92928f2546491).
- First-screen geometry passed at 390/402/430px. Visually inspected synthetic home-priority screenshots at 390 and 430px: assets, triggered review reason and detail/acknowledgment actions fit in the first viewport without horizontal overflow.
- Existing judgment save/revisit, acknowledgment/undo/new evidence, account isolation and startup failure/retry suite passed. No test writes to user accounts.
- Initial run 38062201163 stopped on an older source-order assertion in build143_month_review.mjs; updated that assertion to the intentional new order, then full suite passed.
- Production HTML SHA256 matches local implementation: 81b0ae47071009d3c12d14280c6b042d25762d76e490a3adf1214d52b7c934e8.
- Actual signed-in iPhone usability and 30-second/one-minute targets remain unverified. The screenshots use synthetic account data, not current user holdings.

## Next priority

Inspect performance → stock detail → return continuity for selected period, account and scroll, using existing implementation before changing it.
