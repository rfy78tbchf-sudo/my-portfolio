# Build137 — Exact domestic cash components in bounded periods

Previously, complete-history reporting could reconcile domestic broker deductions,
but bounded periods still used the absolute settlement cash. Loan principal
repayment could look like a trading loss, and a negative net sale receipt could
become positive. Both could exclude otherwise date-verified securities.

The existing raw domestic cash validator now runs before the common ledger CTE.
For bounded periods only, valid records use its reconciled signed cash: exact
settlement cash plus documented loan principal repayment, retaining actual fees,
taxes and interest. Source amount, quantity/price, fee and cash identities remain
mandatory. Unverified records keep their prior treatment; no source transactions
are rewritten, and execution-date and opening-position gates are unchanged.

The entire ALL JSON response was hash-compared against the prior function at the
same database state and was unchanged. The established whole-history calculation
continues using its existing correction path. This does not claim that newly
arriving provisional records always have complete coverage.

Verification: 15 synthetic fixtures exercise the production cash and ledger CTEs,
including negative sale cash, loan repayment, combined charges, buys, future
executions, invalid amounts, missing fields, wrong quantities and foreign rows.
All passed. Owner-scoped bounded and full-period item sums and composition checks
showed zero difference. Bounded-period inclusion increased, while unresolved
corporate actions and execution dates remain excluded.

The realized/unrealized decomposition retains its independent validation gates;
a recovered period total does not automatically certify cost-basis allocation.
Invoker security, ownership filters, function configuration and grants are retained.
