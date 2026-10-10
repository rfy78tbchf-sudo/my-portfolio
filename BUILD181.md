# Build181 — Last-confirmed home summary on full restart

Baseline: aeb9e8aac96d155f2896e1ebe7ae29a96cbbd15a (Build180).

## User outcome

After an existing login is restored, show a small last-confirmed summary synchronously before requesting fresh account data: total assets in KRW, saved/check time, observation basis, holding names/quantities and known KRW valuations. The first eight holdings are visible. The summary is explicitly labeled as stored data, not current performance. Successful core loading replaces it with the normal home. Network failure keeps the dated summary visible and offers the existing retry action.

Use a structured account-scoped local snapshot, never cached HTML or a restored live/calculation object. No token, transaction history, decision reason or AI payload is stored in this cache. Unknown valuation remains null. Summary rows do not open scenario calculations using old balances. The fresh online account remains the source for performance, decisions and comparisons.

The snapshot is saved only after accepted core reads for the current authentication epoch. Different users cannot restore each other's summaries; explicit logout and terminal session removal clear the current account's summary. Entries older than seven days, malformed entries and oversized entries are ignored. Storage failure falls back to normal online loading. No server/database work is required.

## Validation

Nine new isolated cases passed: fresh-runtime restore, account isolation/logout clearing, late-owner rejection, unknown valuations, multi-account aggregation, expired/future/corrupt/oversized entries, unavailable storage, failure retry/escaping, fresh replacement and authoritative empty-account clearing. Existing decision-draft, acknowledgement, staged loading and script/sync checks also passed.

Synthetic 390/402/430px browser journey now runs production startLive after full page reload with the same synthetic account: stored summary appears before refresh completion, offline message keeps it visible, retry switches to fresh data and updates the stored total, and logout removes the cache. Full CI and deployment pending.

## Limits and next priority

This is a dated account-summary preview, not offline performance/decision operation or an offline authentication bypass. An expired session must still be restored by the existing authentication flow before a summary is shown. No real iPhone startup milliseconds or 30-second/one-minute comprehension claim is made. Actual authenticated iPhone/PWA process termination and offline use remain 확인 필요. Next priority: actual daily-run usability and remaining home performance-data waiting, without expanding analytics.
