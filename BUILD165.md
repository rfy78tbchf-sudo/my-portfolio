# Build165 — Recover detail charts without losing drafts

The detail RPC can fail independently of stored price history. Previously that failure became an empty price array and a large “insufficient data” chart.

On detail RPC failure, read the selected security's latest 300 daily prices through the existing authenticated, RLS-protected REST reader. Preserve a technical-indicator warning separately. If prices also fail, show a compact explicit failure and chart-only retry. Successful empty history has its own message. Retry replaces only the chart, preserving decisions, notes and scroll; the existing detail epoch blocks responses after navigation/close.

Verification: live LLY NYS has stored history; the existing detail RPC returns 300 rows under authenticated role at verification time. The original transient failure was not reproduced, so its cause is not asserted. Regression covers fallback success/failure, ordering, retry recovery and stale-response guard. No database schema or account data changed.
