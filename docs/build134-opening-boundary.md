# Build 134 — independently reconciled opening quantity

Monthly P&L could exclude an overseas position because the preceding calendar-day account snapshot was captured before that market day finished. The reconstructed opening quantity then differed from the earlier snapshot.

A narrow fallback now requires an independently synchronized snapshot on the first period day with the exact reconstructed opening quantity, no trades anywhere on that first source-market day, no unknown period execution dates or first-day corporate movements, and a positive historical close on the exact preceding date. Today retains its existing strict snapshot rule. The recovered opening value uses that close and historical FX, not the stale intraday snapshot price. Original records and timestamps are unchanged.

Validation: twelve synthetic SQL cases verify positive recovery and reject wrong quantity/day, stale or duplicate snapshot, first-day trade, unknown date, corporate movement, domestic security, and missing/stale/zero close. Live monthly coverage recovered and composition difference remained zero under the existing timeout. Full response hashes for today, one week, one month, YTD and all history are unchanged. Existing security advisory categories/counts are unchanged; invoker security and grants are preserved.

Priority 1 remains in progress: longer-period execution-day/amount/corporate-boundary evidence is still incomplete. Monthly coverage is not a claim of exact cash FX or whole-account return reconciliation.
