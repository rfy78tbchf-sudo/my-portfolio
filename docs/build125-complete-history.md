# Build 125 — complete all-history display

All-history P&L now resolves three remaining evidence classes without inventing execution dates, transaction prices, or historical FX. This changes only `ALL`; the other nine supported period results are unchanged.

- Domestic cash reconciliation validates original signed settlement cash against gross, fee/tax components, extra charges and explicitly recorded loan principal repayment. Loan principal is excluded from investment P&L. Negative net sale proceeds retain their sign. Every trade, the full quantity ledger and the closing holding must reconcile before the whole-history result is admitted.
- Unsettled USD trades can contribute to an explicitly provisional local-currency result. Broker evidence must be fresh on the holding snapshot day, the settlement must still be in the future, evidence dates and quantities must agree, and no duplicate or unaccounted trade may exist. No historical FX is invented.
- Corporate chains are combined once under the successor security. Both account legs, issuer ratios, ledger balances, all cash receipts and source amounts must reconcile. Fractional proceeds and separate tax/refund movements are included in their own currency; KRW tax attached to a USD chain stays visibly separate from both the USD amount and the headline KRW subtotal.

The UI shows original-record coverage separately from the smaller number of consolidated display rows. Each merged row retains aliases for the predecessor symbols. Numeric coverage is not represented as complete KRW coverage. The headline is still a subtotal of securities with verified KRW values.

## Corporate-action sources

Only public identifiers and issuer terms are encoded in the catalog; no account IDs, holdings, or personal monetary amounts are included.

- MSTY, 1-for-5, December 8, 2025; old CUSIP 88634T493 → 88636X732: [YieldMax notice](https://yieldmaxetfs.com/wp-content/uploads/2025/11/YieldMax-ETFs-Reverse-Stock-Split-Announcement.pdf).
- SOXS, 1-for-10, July 15, 2026; old CUSIP 25461H572 → 25461H291: [Direxion notice](https://www.direxion.com/press-release/direxion-to-split-nine-etfs).
- Velodyne → Ouster, 0.8204 shares per share, February 10, 2023: [SEC merger filing](https://www.sec.gov/Archives/edgar/data/1745317/000119312523033024/d443276d8k.htm).
- Ouster, 1-for-10, April 20, 2023: [SEC filing](https://www.sec.gov/Archives/edgar/data/1816581/000119312523150732/d499395dex991.htm).

## Validation

- Synthetic SQL tests: 19 domestic cash cases, 15 pending-settlement cases, 14 corporate-chain cases; zero failures.
- Owner-scoped preview: no missing numeric rows; source-record coverage is conserved; every displayed row and the KRW subtotal reconcile.
- Already-calculated records and all nine bounded-period responses compared unchanged.
- UI coverage adds provisional labels, consolidated aliases, separate-currency tax and narrow-screen overflow checks.

The migration replaces the existing SQL invoker function with an empty search path. It neither modifies source transactions nor changes authentication, RLS or grants.
