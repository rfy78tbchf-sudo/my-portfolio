# Build185 — Clear finish state for saved-judgment checks

Baseline: c93dbf0f9b159deb9a2161ee0669ff5b870b89e6 (Build184).

## Friction addressed

After explicitly acknowledging the final triggered review, the previous handler always kept the review panel open. Its expanded cards and repeated heading obscured whether the daily saved-judgment check was finished. The home title also did not distinguish manual checks from unavailable evidence.

The saved-judgment area now derives a structured status from the same existing review-condition evaluation. Once there are no unacknowledged triggers, manual checks, pending conditions, loading or failed review reads, it displays “새로 점검할 판단 없음.” An explicit final acknowledgement closes the panel and moves focus to its summary. Another due/manual/unknown item keeps it open. Undo and new evidence continue to restore the reminder using Build179's existing account-scoped storage behavior.

Manual conditions, unavailable evidence and active/failed reads have distinct titles. No saved judgments is not classified as completed. The duplicate nested review heading is hidden within the disclosure; existing detail content and controls remain accessible when opened. This is a scoped saved-judgment status, not a declaration that the entire portfolio has no risk or that trading is needed.

## Verification

Ten acknowledgement/status tests pass, covering persistence, account isolation, undo, new evidence, corrupt/unavailable storage, unresolved conditions and final-versus-partial completion. Build178 home-context checks and inline JS parsing pass. Full mobile CI run 38061004404 (job 114239081636) passed at 390/402/430px, including final acknowledgement collapse, reload persistence, undo and new-quote reactivation. Existing decision save/revisit journeys passed in the same suite. Artifact 11673181953. Visually reviewed the 390px checked summary, triggered review and decision-context screenshots: completed state is compact, the expanded trigger has one visible heading and the saved reason/condition remains readable.

Initial CI run 38060874214 failed because an old browser assertion expected the removed duplicate inner heading. Test-only follow-up b8f077029c8fd2ca07b2c47525529fd1035e9f8f checks the visible outer summary and verifies the inner heading is hidden. Implementation commit 7e3779ff64fc17b00cdab71dad437f50eca2d17d. Pages run 38061003867 succeeded. Retrieved production index.html matches the local implementation: SHA-256 d125129fa6c21b66c7d8d4bc7240100dd6743f2636ac505fec34b7d803b5fbd7.

No new server/database writes, orders, test trades or user-account test judgments. Existing decision save/revisit flow is retained and will run through the mobile regression suite. Physical iPhone daily comprehension and the 30-second/one-minute usability goals remain unmeasured.

## Next priority

Verify the first-screen priority and the end-to-end ordinary daily visit in actual iPhone use. Keep manual/unknown states distinct, preserve the existing judgment flow, and avoid adding prompts or analytics merely to generate daily activity.
