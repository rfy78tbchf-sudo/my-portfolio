# Build 133 — period audit and corporate re-entry

Priority 1 remains in progress. No new product features are added.

## Fixed
Whole-history corporate groups previously required every member to have zero ending holdings and no pending events. A new purchase caused a previously verified corporate chain to disappear from calculated P&L.

The resolver now requires verified corporate legs, nonnegative historical quantities, validated trade cash, and a reconciliation of ledger ending quantity plus validated pending movements to current holdings. Pending movements must be fresh, counted once, occur no earlier than the last ledger movement, and never make running quantity negative. Held positions require a positive valuation at the current cutoff. Native P&L includes ending value; it is not labeled realized P&L when holdings or unsettled events remain. Historical FX reference conversion retains its existing cash reconciliation gate.

## Validation
Twenty synthetic SQL cases passed: closed history and valid re-entry accepted; invalid corporate legs, ratio, raw source quantities, transfer cash, source data, dividend reconciliation, omitted trades, negative running quantity, stale pending evidence, wrong pending count, wrong ending quantity, stale valuation, and overselling rejected. Live read-only checks covered nine period choices with no duplicate security IDs and zero arithmetic composition differences in calculated subsets. Whole-history coverage recovered. Security invoker, RLS, grants, JIT and scoped work buffer settings remain unchanged. Existing advisory categories remain unchanged.

## Remaining work before priority 1 is complete
- Month-boundary opening snapshots can precede overseas executions whose source trading date is the previous calendar day. Exact timestamp/market-day attribution needs independent evidence; do not silently override the quantity mismatch gate.
- Multi-month and annual subsets still have missing execution dates, amount checks, and corporate quantity boundaries. All-history cash totals do not establish exact partial-period attribution.
- Zero composition difference verifies arithmetic within the calculated subset, not brokerage reconciliation or completeness of the entire account. Native FX results and KRW reference amounts remain distinct.
