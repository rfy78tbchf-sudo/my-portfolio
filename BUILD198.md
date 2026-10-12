# Build198 — Carry the home period into stock contribution

Baseline: main e1956b2 / Build197. Home's “수익” quick link used the generic tab switch, leaving the stock-performance period/view/search from a previous visit. A user looking at recent three-month home performance could land on this-month realized results with an old filter still hiding stocks.

Use a dedicated home-period route. Transfer the selected home period exactly (recent 1M remains 1M, not THIS_MONTH), open total stock contribution ordered by impact, and clear stale search/scope filters. Reuse the existing today route for today. Existing period cache, request guards, stock detail and return behavior remain. The independent bottom navigation retains its prior behavior. No calculation, account scope or write changes: home account performance and KB stock contribution remain explicitly scoped separately.

Local tests passed all selectable non-today periods, cleared view/filter state, cached render behavior, and the existing today route/cache/race tests. Mobile scenario opens the real home quick link from 3M with a prior realized view and stale search, checks 3M total contribution and visible results, and captures the screen. Full verification completed below; synthetic fixtures only, no real account writes.

Next priority: inspect contribution-to-stock-review context and back navigation for remaining user-visible friction. Real signed-in iPhone timing remains unverified.


## Completed verification — 2026-10-12

Resumed in the new chat from main 2b6463d. The initial browser check had two fixture defects: home performancePeriod still referred to 1M after selecting 3M, and the base fixture had no stock response. Fixed test setup to use a matching loaded home period and the existing stock-performance fixture. No further application-code change was needed.

Expanded the mobile journey to open ARM from home-selected 3M contribution, assert the 3M period-loss context in detail, return via the visible return button, and verify the same period/view, cleared search, original scroll position and originating button focus. No decision writes occur.

GitHub Actions run 38189349478 passed at ebeba34b664311b150ba793e31db7234a2d13927: Chromium 390/402/430px (including this journey and retained refresh values), focused WebKit navigation, and existing chart/regression checks. Pages deployment run 38189349213 succeeded. Downloaded and visually inspected the 390px home-selected-period capture: 3M selection, total stock P&L and gain/loss contribution links are readable. Capture uses synthetic values and dates, not owner account results.

Production index.html SHA256 matches local Build198: 9bea955eb9ab9f3c403f83afda4c3a98f3e7a17ccb2994087447528a845bde69. Physical signed-in iPhone latency and live financial reconciliation remain unverified.
