# Build144 — demand-loaded heavy P&L

The initial full-data batch no longer requests period stock P&L, realized sale details, or the legacy ledger realized calculation. Home and holdings can render when the base batch completes, before secondary flow, decision metrics and swing-price reads finish.

The performance total view starts its selected-period calculation on entry with an explicit loading state. Existing realized-view loading is retained; current unrealized holdings do not start period-total calculations. Detailed total composition can still request realized evidence after the total result arrives. Requests retain existing period and snapshot identity guards. A refreshed base snapshot invalidates prior P&L and the visible performance view requests new results.

Validation: synthetic tests assert three heavy RPCs are absent from initial batch, early rendering precedes secondary reads, demand loading starts once, unrealized/realized views do not trigger total on entry, and old snapshot responses are discarded. Existing period retry and late-response tests pass. No live-device seconds-saved claim is made; other base-batch queries still affect latency.
