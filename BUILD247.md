# Build247 — reconciled settlement price precision

## Reproduced issue and scope
Normal settlement collection produced a sale whose execution-summary price and ledger price differ at the sixth decimal, while account, asset, currency, order/settlement dates, quantity and net proceeds agree. Exact price equality left both the settled and pending sale visible. Source ledger price matches its original payload. No financial records were changed.

The realized-sales RPC now excludes that pending row only when a unique ledger and unique active execution summary reconcile: same dates/quantity/net, same four-decimal price, total price difference and both gross/net arithmetic within the existing two-cent monetary guard, nonnegative costs, API source and a single source occurrence. Exact-price behavior remains unchanged. This link does not prove acquisition basis or promote estimates. Period P&L and closed-cycle calculations are unchanged.

## Validation
Synthetic test reproduces two rows before and one after, preserving the entire settled item. Ambiguous ledger/evidence, differing dates, quantities, cash, fees, prices and missing source evidence retain pending rows; account isolation and read-only ledger invariance pass. The full Build246/245 source, FX, period and estimate invariants also run against the new RPC. Required CI runs Chromium/WebKit at 390/402/430px and 100/125%. Local browser launch was unavailable because its binary is absent; CI must pass before release. No actual iPhone claim.

## Remaining evidence / next action
New settled sales have ledger-matching proceeds and fees/taxes. Two retain dated-average estimates; the unmatched-basis sale has older observations but none in the permitted seven-day pre-sale window. Its later pending sale also lacks eligible dated basis. Do not backdate current or post-sale holdings, extend the freshness window arbitrarily, or replace unknown profit with zero. Historical 1M/3M cost/FX and the official-source reconciliation gap still require genuine dated source data / broker allocation detail. No new official realized source revision is available. Automatic normal collection remains usable; previously blocked broker credential/token issuance is not retried.

## Release gate
Prepared on existing work/performance-detail-render-234 from 9957b88. Await final commit CI, guarded main promotion, migration application and live RPC/Pages verification. Frontend marker245 is intentionally unchanged; this is a backend-only correction. Rollback is the get_live_realized_sales definition from Build246. No UI, wealth-goal, ledger, account scope or currency-unit change.
