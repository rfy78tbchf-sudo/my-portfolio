# Build140 — Opening valuation and complete period inclusion

Corporate groups now reconstruct opening quantities from verified transfer pairs and period trade flows. A nonzero opening position requires a separate unadjusted broker close; the adjusted chart series is never multiplied by old share counts. Cash, distributions and taxes use the selected period. Historical acquisition costs are not inferred, so closed positions with an opening balance do not automatically acquire a realized-P&L breakdown.

A restricted market-price table stores unadjusted MSTY/SOXS closes from GSC10060 with `mdfy_stk_prc_use_f=0`. It contains public market data only. Authenticated users can read; only service-role code can write. Daily cached collection runs with existing balance sync and handles month-end date clamping. Chart prices remain untouched.

For ambiguous domestic execution dates, exact amount/quantity matches with balanced evidence counts can certify KRW period membership only when every possible matched date is inside the window. No execution timestamp is written or invented. Windows crossing any possible date remain excluded. Whole-history fallback behavior is preserved.

Opening holdings can also be verified against a nearby independent snapshot by reversing known intervening trades. The snapshot day must have no trades; quantity, synchronized account observation, source completeness, corporate-action absence and exact prior-day close checks remain mandatory.

Verification: 23 corporate opening fixtures (including nonzero opening value and missing price), 16 period-membership fixtures and 15 snapshot rollback fixtures passed. Collector tests verify unadjusted mode, once-daily caching and month-end boundaries. Live owner-scoped checks covered all ten period codes: every candidate had a native-currency P&L, composition and item sums reconciled to zero difference, and no duplicate security IDs appeared.

Full native-currency inclusion is not a claim that every KRW conversion or realized/unrealized allocation is confirmed. Unsettled executions remain provisional. New transactions or missing future market data can legitimately reopen verification gates.
