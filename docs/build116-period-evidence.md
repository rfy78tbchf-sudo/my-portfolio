# Build116 — Period evidence display consistency

Resumed from deployed Build115. Read-only owner-scoped production review found
that Today still excludes positions whose reverse-calculated opening quantity
does not match the prior account snapshot. Overseas order dates and Korean
snapshot boundaries require further evidence; no date was shifted and no
transaction or account value was changed to force a match. Month coverage is
also partial. Formula balance is not proof of full account reconciliation.

Corrected the period screen's outdated historical-close-only explanation to
match Build115's snapshot-first behavior and unresolved-trade-date exclusion.
Aligned row display and positive/negative subtotals with the existing sorting
rules: rows with a reason, blank amounts, or nonfinite amounts cannot display
as calculated P&L. Local-currency breakdowns also reject unresolved values.
The existing collapsed detail layout is retained.

Validation: targeted renderer regression covers a contradictory unresolved
numeric result, nonfinite and blank amounts, and current basis text. Existing
period loading, composition, reconciliation, clarity, and Today navigation
regressions pass. Owner-authenticated iPhone interaction is not claimed.
Remaining: reconcile overseas order-day vs snapshot-time boundaries, missing
monthly quantity evidence, and the account-versus-stock residual.
