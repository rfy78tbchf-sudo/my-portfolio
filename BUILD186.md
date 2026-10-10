# Build186 — Put triggered judgment reviews next to total assets

Baseline: 7ceaa0d6fe27bab7b49ea031bbf2dfc47cf36dd2 (Build185).

## Scope

Verified in the current home renderer: triggered saved judgments followed today performance and shortcut navigation. Move the existing triggered-review section immediately after total assets. Keep its saved reason, condition, detail route, acknowledgment and undo controls. Quiet/manual/pending-only reviews retain their existing lower collapsed position. No new summary card, trading suggestion, data read or calculation is introduced.

## Verification

Mobile fixture adds first-screen geometry and section-order checks at 390/402/430px, plus a top-of-home screenshot. Existing acknowledgment, revisit, new evidence, judgment detail/draft/save and startup failure/retry scenarios remain in the full suite.

Validation and deployment results: pending. Actual signed-in iPhone usability and 30-second/one-minute targets remain unverified.

## Next priority

Inspect performance → stock detail → return continuity for selected period, account and scroll, using existing implementation before changing it.
