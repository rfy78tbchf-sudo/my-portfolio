# Roadmap 3 audit — 2026-10-14

Baseline: b009263547b13cc6a44f1e0cb3116a0058a80015 (Build201). No application or database changes in this audit.

Status: incomplete. User-provided October 12/13 screens demonstrate partial period and realized coverage, not independently reconciled broker totals. Do not treat either partial total as complete portfolio performance or subtract differently scoped totals to infer unrealized change. Private account amounts and identifiers are intentionally omitted from this public record.

Reviewed current frontend stockRealizedItems, stockRealizedRows, stockTotalParts and the checked-in Build152 realized-sales SQL. Missing trade ordering, cost, source cash/charges, or historical FX can exclude results; settlement passing alone is not proof of recoverability. Closed-position aggregation requires full coverage; official broker evidence takes priority. Specific unresolved securities cannot be attributed to one cause from the supplied screenshots alone. Production SQL parity and live owner data have not been checked in this audit.

Executed tests/build79_closed_realized.mjs, tests/build149_execution_sales.mjs, tests/build76_separated_pnl.mjs and tests/build126_pnl_scope.mjs successfully against Build201 files. These synthetic production-function checks cover closed-cycle replacement, ticker/ISIN aliases, no duplicate totals, unsettled evidence, unknown versus zero, separate native/converted coverage, account scope, stale responses and fees/taxes. They do not verify actual broker financial amounts. No confirmed calculation defect was established, so no speculative accounting changes were deployed.

Operational blocker: prior unscoped account-owner enumeration was rejected by automatic approval review because it included all users. Do not repeat it or infer an owner from holdings. Obtain the user's app login identity or an authenticated owner-scoped export, then limit all live checks to that owner. Broker reconciliation also requires matching dates, account scope, currency, fees and valuation conventions.

Next: identify exact exclusion reasons in the authorized account; trace source/settlement and opening-value evidence; fix only evidenced defects; compare like-for-like with broker evidence. Roadmap 2 remains partial pending physical iPhone Face ID/resume/latency verification. Home toolbar rollback remains in force.
