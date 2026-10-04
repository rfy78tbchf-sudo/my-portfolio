# Build126 — prevent partial KRW results from looking like overall profit

The previous screen promoted the KRW-convertible subset as a large positive headline while leaving substantial USD losses below the fold. Its loss comparator also preserved the input order of local-only foreign rows. Numeric row coverage did not establish complete portfolio P&L.

Changes:

- When any local-only foreign rows exist, the hero shows the KRW-calculated portion and every unconverted currency subtotal at equal prominence. It explicitly says that the overall KRW total is not established.
- Separate KRW tax movements attached to foreign corporate chains are included once in the displayed KRW-calculated portion, and remain excluded from the USD subtotal. Already-converted foreign rows remain only in the KRW portion, preventing duplicate inclusion.
- The old realized/dividend/remainder breakdown is collapsed and explicitly scoped to the KRW-convertible securities. It is not presented as a composition of the entire portfolio.
- Loss/profit/impact ordering includes foreign rows using an account-snapshot FX reference only for comparison. Original P&L values and historical conversion eligibility remain unchanged. Missing reference FX never becomes an assumed exchange rate; those currencies are ordered internally.
- Fully closed corporate chains expose net trading proceeds plus fractional settlement separately from dividends and same-currency tax/refunds. The two components sum to the existing local result. Separate KRW taxes remain visible.

The database function adds component metadata and comparison FX from same-cutoff account holdings, with positive, non-null, consistent rates per currency. It remains an invoker function under existing RLS and grants. No source transactions, quantities, prices or monetary P&L values are altered.

Validation: owner-scoped comparison found no changed pre-existing row fields and no component sum mismatches. Synthetic tests cover omitted foreign losses, current-reference ordering, missing/invalid FX, tax counted once, no duplicate already-converted rows, and the partial-total presentation. Mobile fixtures check the largest foreign loss appears first and the two-currency overview fits narrow screens.
