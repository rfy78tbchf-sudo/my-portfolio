# Build194 — Refresh when a quick return crosses Korean midnight

Baseline: main f11ac2e / Build193. The existing three-minute return throttle used elapsed time only. A home visit at 23:59 followed by a return at 00:00 could therefore keep yesterday's rendered checkpoint state and skip current-day reads. No new feature or screen is needed.

Keep the fast path only when elapsed time is nonnegative, below three minutes, and the last completed load is on the same Korean calendar day. A Korean date change refreshes through the existing data path. Concurrent focus/visibility requests remain coalesced; confirmed data stays visible and existing scroll/tab preservation is retained. Clock rollback no longer extends the throttle. No broker order, database, auth, or performance formula changes.

Regression reproduced against baseline: the one-minute midnight return performed zero reads. Fixed tests pass for Korean midnight, ordinary quick return, UTC midnight, clock rollback, coalesced requests, retained data and hidden-page guard. Existing refresh/scroll and loading/failure tests passed locally. Added mobile synthetic midnight return: a tomorrow checkpoint becomes due, the review section opens, and one refresh occurs.

Mobile CI and deployed screenshot verification pending. No real account writes. Physical iPhone standalone/background behavior and daily-use timing targets remain confirmation needed. Next priority: practical signed-in iPhone return verification; retain completed home, draft, and review flows.
