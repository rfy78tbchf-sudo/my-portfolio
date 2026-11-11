# Build119 — Finish the all-history composition view

The period P&L endpoint returns the actual first transaction date for ALL, while
the realized-sales endpoint uses 1900-01-01 as its unbounded lower date. The UI's
strict date equality prevented composition from rendering after a successful
ALL request. Accept that specific sentinel for ALL only, while retaining period
and end-date equality and strict start-date equality for bounded periods.

Only valid calculated symbols contribute to composition. Reject blank and
nonfinite amounts and rows with unresolved reasons. Missing-sale counts respect
aggregate coverage counts. The remainder stays explicitly unseparated; it is
not presented as confirmed unrealized P&L. The realized amount still covers only
calculated ledger sales and may remain incomplete.

A 20-second completion watchdog covers the full realized-sales request,
including authentication and response parsing. Timeout ends the loading state
and exposes the existing retry button. A late response cannot replace a timed
out result, a retry, a newly selected period, or another account's live state.

No database, source ledger, execution-date matching, or financial amount is
modified. Calculation-pending symbols remain pending. Synthetic tests cover
the sentinel exception, incompatible date ranges, invalid amounts, subtotal
identity, timeout, retry, failure and stale responses. Existing period and
reconciliation tests are also run. Deployment includes the mobile UI gate.
