# Build274 — require a shared cutoff for total-asset allocation

The old allocation gate accepted any positive total greater than the known stock subtotal. A mixed/unknown ISA valuation time could therefore produce a residual slice from incomparable observations. The operating scope explicitly reports unknown ISA effective time and unverified account identity.

Total-asset mode now requires one identifiable KB account, verified account separation/identity, equal primary/ISA/risk/holding valuation cutoffs, matching total and holding quantities, and valid holding valuations. Otherwise the existing stock-only comparison is used, with no fabricated residual. The total-asset selection stays available when a fully aligned synthetic basis satisfies these requirements. This does not make the residual cash, establish whole P&L or rewrite financial data.

Independent synthetic example: stock values 300+100, displayed total 500, unverified cutoff previously made a 100 residual (20%) and a 60% first stock. Candidate has no residual, uses the explicitly labeled 400 stock denominator and 75% first stock. Verified same-cutoff fixture preserves 500/100/60%. Missing ISA time, failed identity, stale risk time, changed holding quantity, absent holding time and total mismatch all select stock-only comparison.

Update manifest and service-worker cache are versioned 274. Browser regression expectations explicitly check disabled unverified total mode, absent residual, widths/zoom and detail return. No new data requests or P&L arithmetic changes. Exact-commit CI and live deployment verification are required before reporting deployment.

Remaining: whole-account A/B, original-currency cash/FX, ISA historical opening, linked normal v86 collection and response-batch consumers remain incomplete. Continue Build273 branch for batch integration; do not duplicate its prototype. Real iPhone validation remains separate.
