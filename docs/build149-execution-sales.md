# Build149: Include sales before settlement

The realized-sales list used only cash-ledger transactions. Active SPQM2205 sell evidence is now included by broker order date when no matching cash-ledger sale exists. Matching uses account, ISIN, currency, settlement date, quantity and price. Inactive evidence is excluded. No ledger facts are fabricated or changed.

Pending rows have no calculated profit, remain outside totals, and expose sale date, quantity and expected settlement date. Rows are grouped by symbol and currency. Closed-period replacement still requires coverage count agreement. All-unknown results say 자료 확인 필요 rather than 계산 대기 or 일부 계산. The hero shows sales and symbol counts. Reviews accept owned active execution evidence as well as settled sales.

Live authenticated verification on 2026-10-06: 7 sales / 5 symbols, including 5 unposted executions (ARM twice, MU, SOXS, SOXL). Existing settled SOXL is not duplicated. SK source-cost discrepancy and SOXL intraday allocation uncertainty remain unresolved; this release does not claim those profits are known.

Regression: grouping, pending reasons and dates, unknown amounts, aggregate coverage guard, full render; existing sale-review regression. RPC remains SECURITY INVOKER and retains account ownership and RLS.
