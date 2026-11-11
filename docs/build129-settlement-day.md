# Build129 — keep same-day settlement provisional and the reference panel discoverable

At the KST date rollover, fresh pending orders settling on the new day failed a strict future-date condition. Their native-currency results became unavailable and the all-covered reference conversion panel disappeared completely.

Allow settlement on the snapshot's calendar day while retaining the same-day evidence freshness, raw field, quantity, amount, full-ledger and holdings reconciliation checks. Orders already matched to ledger settlement remain excluded by the existing pending-source anti-join. Past settlement dates remain rejected. Same-day eligible rows remain explicitly provisional.

The reference panel remains below the currency totals and above the KRW composition. Its summary now has a distinct bordered touch target. When coverage is incomplete, this location displays the number of unresolved items instead of disappearing; no partial reference sum is labelled as a total.

Validation: 16 synthetic pending-source cases include settlement today (accepted), expired settlement with internally consistent evidence (rejected), stale source, duplicates, bad amounts, source/quantity mismatches and stale holdings. The current owner-scoped result regained complete numeric and reference coverage. UI tests exercise the unavailable placeholder and expanded reference panel on narrow screens.
