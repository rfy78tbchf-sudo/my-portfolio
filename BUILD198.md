# Build198 — Carry the home period into stock contribution

Baseline: main e1956b2 / Build197. Home's “수익” quick link used the generic tab switch, leaving the stock-performance period/view/search from a previous visit. A user looking at recent three-month home performance could land on this-month realized results with an old filter still hiding stocks.

Use a dedicated home-period route. Transfer the selected home period exactly (recent 1M remains 1M, not THIS_MONTH), open total stock contribution ordered by impact, and clear stale search/scope filters. Reuse the existing today route for today. Existing period cache, request guards, stock detail and return behavior remain. The independent bottom navigation retains its prior behavior. No calculation, account scope or write changes: home account performance and KB stock contribution remain explicitly scoped separately.

Local tests passed all selectable non-today periods, cleared view/filter state, cached render behavior, and the existing today route/cache/race tests. Mobile scenario opens the real home quick link from 3M with a prior realized view and stale search, checks 3M total contribution and visible results, and captures the screen. Full CI and production visual verification pending; synthetic fixtures only, no real account writes.

Next priority: inspect contribution-to-stock-review context and back navigation for remaining user-visible friction. Real signed-in iPhone timing remains unverified.
