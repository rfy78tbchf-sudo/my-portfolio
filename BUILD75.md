# Build 75 — period stock profit and loss

The performance page previously listed only computable realized sales and dividends. It now calculates the change in stock wealth over a selected period: ending valuation minus opening valuation, plus net sale/purchase settlement cash and net dividends. Fully sold positions remain included. Opening quantities are reconstructed from the current holdings and net period trades; no artificial ledger rows are written.

- Separate calendar month and trailing month selectors with explicit dates.
- Owner-scoped, security-invoker RPC `get_live_period_stock_pnl`; no anonymous execute privilege. Existing ledger and decision records are untouched.
- Join overseas execution dates and pending settlement evidence; exclude duplicate settled entries. A repeated fetch timestamp does not remove an existing trade.
- Opening prices precede the selected start date. USD cash flows use dated reference FX; ending holdings use their recorded FX. No fabricated prices or balances.
- Partial results remain partial. Negative reconstructed quantities, corporate events, invalid amounts, missing prices/FX or missing security mappings prevent a complete claim. Unknown values are not zero.
- Scope is KB primary brokerage stocks, excluding ISA, cash FX, interest and separately recorded expenses. This is combined period stock P&L, not the brokerage's exact realized-profit report or a complete account return. Historical ranges with unresolved events remain incomplete.

Validation: isolated SQL fixture asserts USD45 / KRW59,500 with same-day buy/sell, net fees, dividend, pending sale, duplicate exclusion and repeated retrieval; missing opening price and negative opening quantity stay unknown. UI tests cover 390/402/430px, 125% enlargement, period switching, failed fetch/retry, stale responses and existing decision-entry regression. Production read-only audit at 2026-09-29 15:10 KST calculated 22/22 September stock positions. Live data was not modified. Physical iPhone and authenticated owner navigation require user confirmation; offline operational-data rendering is not an authenticated end-to-end test.
