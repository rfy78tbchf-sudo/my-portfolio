# Build185 — Clear finish state for saved-judgment checks

Baseline: c93dbf0f9b159deb9a2161ee0669ff5b870b89e6 (Build184).

## Friction addressed

After explicitly acknowledging the final triggered review, the previous handler always kept the review panel open. Its expanded cards and repeated heading obscured whether the daily saved-judgment check was finished. The home title also did not distinguish manual checks from unavailable evidence.

The saved-judgment area now derives a structured status from the same existing review-condition evaluation. Once there are no unacknowledged triggers, manual checks, pending conditions, loading or failed review reads, it displays “새로 점검할 판단 없음.” An explicit final acknowledgement closes the panel and moves focus to its summary. Another due/manual/unknown item keeps it open. Undo and new evidence continue to restore the reminder using Build179's existing account-scoped storage behavior.

Manual conditions, unavailable evidence and active/failed reads have distinct titles. No saved judgments is not classified as completed. The duplicate nested review heading is hidden within the disclosure; existing detail content and controls remain accessible when opened. This is a scoped saved-judgment status, not a declaration that the entire portfolio has no risk or that trading is needed.

## Verification

Ten acknowledgement/status tests pass, covering persistence, account isolation, undo, new evidence, corrupt/unavailable storage, unresolved conditions and final-versus-partial completion. Build178 home-context checks and inline JS parsing pass. Browser coverage now asserts final acknowledgement collapses the panel, reloading preserves the checked state, undo reopens the reminder and new quotes create a fresh check. Full mobile CI, screenshot review and production-source verification pending.

No new server/database writes, orders, test trades or user-account test judgments. Existing decision save/revisit flow is retained and will run through the mobile regression suite. Physical iPhone daily comprehension and the 30-second/one-minute usability goals remain unmeasured.

## Next priority

Verify the first-screen priority and the end-to-end ordinary daily visit in actual iPhone use. Keep manual/unknown states distinct, preserve the existing judgment flow, and avoid adding prompts or analytics merely to generate daily activity.
