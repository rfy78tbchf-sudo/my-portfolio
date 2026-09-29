# Build 77 — Period total composition

Current unrealized P&L remains acquisition-cost-relative P&L for current holdings.
The period total now displays calculated ledger realized P&L and a clearly named
unseparated remainder. The remainder is not asserted to be unrealized P&L: it can
include period valuation changes, unresolved sales, dividends and basis differences.

Only realized rows for symbols included in the calculated period total are compared,
and period boundaries must match. Unknown realized amounts remain unknown. Displayed
rounded components reconcile arithmetically. This is a partial breakdown, not a repair
of missing trade bases or a complete realized/unrealized attribution.

No database, worker, account, ledger or decision writes. Existing RPCs reused.

Validation: composition unit checks; existing mobile suite at 390/402/430px,
125% text, keyboard, chart touch, separated tabs and late-response regressions.
Screens use isolated fixtures, not owner account mutations. Owner iPhone not tested.
