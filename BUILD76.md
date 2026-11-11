# Build 76 — separate valuation and realized profit views

- Performance now has three explicit views: period total, current unrealized P&L, and period realized P&L. The existing combined period calculation is unchanged.
- Unrealized P&L uses the same current holding basis as the portfolio list, scoped to the primary KB brokerage account. It is acquisition-cost-relative current P&L, not period valuation change. The period selector is absent in this view to avoid implying that these figures change with the period.
- Realized P&L calls the existing owner-scoped `get_live_realized_sales` for the selected period. KRW sales use native realized P&L; overseas sales use the returned historical-FX estimate. No dividend or sale-proceeds substitution. Currency-native subtotals remain visible.
- Unknown acquisition cost or FX remains unknown; partial totals display excluded sale counts. Pending sales absent from the settled ledger are not fabricated or derived by subtracting current unrealized P&L from period total. The existing broker-day inquiry remains accessible.
- Failed queries support retry; repeated tab clicks reuse results; late responses cannot overwrite a different period or refreshed live account data. Existing holdings, ledger and decision records are unchanged. No DB schema or edge-function changes.

Validation: isolated calculation/aggregation and async tests, actual production renderers at 390/402/430px and 125% enlargement, tab switching, correct primary-account scope, unavailable versus zero, period switching, and prior decision/comparison regression. Existing server function fields and invoker security verified read-only. Browser screenshots use synthetic fixtures, not an authenticated owner session. Physical iPhone review is separate.
