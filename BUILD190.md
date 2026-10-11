# Build190 — Visible home asset basis during normal and failed loads

Baseline: 4af4d41 (Build189). Scope: home freshness readability.

The main asset observation dates were hidden in account details. The period-error/period-loading early branch also omitted existing account refresh failure and retry status. Replace the existing basis summary with visible KB/ISA observation timestamps in KST, including year. Timestamp sources follow the displayed total: account-scope observations for scoped totals, snapshot timestamp/date otherwise. Missing/invalid timestamps remain unknown; date-only snapshots do not invent a time. Preserve account failure/retry and dates in the period fallback while retaining confirmed assets.

No new card or financial calculations. Tests cover source selection, KST/year, missing dates, visible collapsed-summary timestamps and simultaneous account/period failure with unchanged assets. Full mobile verification pending. Actual signed-in iPhone remains unverified.
