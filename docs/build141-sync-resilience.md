# Build 141 — refresh resilience

Roadmap order: period P&L completeness; speed and automatic sync stability; home review priorities; saved decision followup; drawdown alerts; closed-position review.

This increment coalesces concurrent full-data loads, avoiding duplicate batches. Failed full-data refreshes preserve the previous screen data and expose the existing error state. Broker refresh continues sequentially through each history month and prices even if an earlier source fails. The completion notice distinguishes partial broker failure and data-load failure from success.

No P&L formulas, trade records, authentication rules, or broker order actions change. This is an initial improvement to step 2, not a claim that all performance work is finished.

Validation: synthetic failures in balance and the first history month still execute the remaining month and prices; no concurrent broker steps; overlapping data loads share one promise; rejection releases the load lock for retry; inline scripts parse. Mobile workflow validates existing app flows.
