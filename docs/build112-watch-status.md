# Build112 — Separate peak formation from missing price data

Home swing-peak coverage now partitions positive holdings into confirmed peaks, valid history awaiting a new/confirmed peak, and price/metadata issues. The old pending count combined the last two groups. A breakout is not a data retrieval failure and is now listed under the collapsed New peak forming group. Price issues remain separately accessible in a collapsed group, with both groups linking to detail when metadata exists.

Neither forming nor missing-data securities are counted in the confirmed-peak denominator or assigned a fabricated drawdown. The peak algorithm, -15% threshold, stale-price limits, and source/currency checks are unchanged. A breakout label explicitly refers to the previous peak having been broken, without claiming today's price is still above it.

Validation: mixed synthetic holdings assert a disjoint count partition and separate labels. Production mobile tests exercise both groups' collapsed defaults, expansion, and detail navigation at 390/402/430px. The screenshot supplied by the user is contextual evidence only; no live account values were changed or inferred into the database.
