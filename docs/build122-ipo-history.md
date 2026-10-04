# Build122 — Reconciled IPO acquisitions in all-history performance

All-history domestic IPO positions can now derive acquisition cash from original
subscription payments, additional payments and refunds, linked to a single share
receipt. The net subscription cost includes fees. This is a derived calculation;
no original transactions are changed or artificial purchases stored.

Eligibility requires one initial payment and one receipt, at most one additional
payment/refund, API KRW sources, matching price, raw gross/net cash agreement,
nonnegative fees and zero tax on subscription events, gross allocation equal to
receipt quantity times price, payment before receipt, sale on/after receipt day,
all sales before cutoff, fully closed quantities, no other buys, and independently
reconciled sale cash. Other unrecognized corporate events still block calculation.
Only ALL is eligible. Bounded periods are unchanged.

18 SQL fixture cases passed against the actual IPO CTEs, including fee-bearing
refunds, additional payments, duplicates, missing evidence, wrong gross/quantity,
invalid sale evidence and sale/receipt date boundaries. Production preview adds
five KRW positions, with prior calculated items unchanged. Currency display
filters were deferred and are not in this release. Detail view explains IPO basis.

Remaining unresolved histories include splits/mergers, pending/held foreign
positions and domestic cash discrepancies; this is not a claim of full coverage.
Rollback restores Build121 function and frontend.
