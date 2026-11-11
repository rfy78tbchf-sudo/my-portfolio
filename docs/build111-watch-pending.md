# Build111 — Inspect pending swing-peak coverage

The existing pending count is now a collapsed list. Opening it shows each held security and one short reason: missing prices, stale prices, invalid date, unconfirmed peak, new peak awaited after breakout, or insufficient/invalid price history. No unknown security is counted as checked, and the existing -15% threshold and peak calculation remain unchanged.

Resolved security rows open the existing detail chart; missing metadata stays noninteractive. The lengthy calculation explanation remains removed. The list starts closed and preserves its open state when returning from detail.

Validation: synthetic classification checks plus production-renderer mobile tests at 390/402/430px verify collapsed rows, expansion, chart navigation and return. Existing swing-peak thresholds, sorted detail journey, chart settings and form checks run in the same suite. User-authenticated phone confirmation remains separate.
