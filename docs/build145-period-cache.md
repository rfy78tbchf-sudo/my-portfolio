# Build145 — reuse selected-period calculations

Continues Build144's demand-loaded P&L. Successful period results are reused when returning to a previously viewed period within the same loaded balance snapshot and KST day. Switching away and back while a calculation is pending shares that request. Failed or invalid results remain retryable. Older period or snapshot responses cannot replace the selected result.

Cache lifetime is limited to the current in-memory live object and KST day. A full data reload, including refresh after background history synchronization, creates a new object and requires fresh calculations. This deliberately does not reuse results across refreshes without an authoritative database revision. No database or calculation formulas changed.

Validation covers cached period revisit, pending request deduplication, out-of-order completion, rejected/invalid-result retries, day rollover, and replaced snapshots. Build131 and Build141–144 regression tests pass. No live account latency measurement or database-query speedup is claimed.
