# Build187 — Resume the originating stock after a background refresh

Baseline: Build186, e45c40f (latest main verified before edits).

Existing normal detail close restores scroll and retains the performance view; no filters were rebuilt. Found a gap: background render replaces the original button, so close skips focus restoration when its saved node is disconnected. Resolve the equivalent visible button in current content using its exact stock/action identity, including sale currency. Keep preventScroll and existing return position. If the row no longer exists, do not focus a different stock.

Mobile test simulates background replacement while detail is open, then uses the bottom return button and checks selected performance, scroll and focus at 390/402/430px. Existing close, judgment draft/save/revisit tests remain.

Verification completed:
- Full mobile workflow 38103947983 passed on a4cba8b714a30c2b0b0f71d52a98eaf3ab5e0d06, including background replacement → bottom return → same period/performance/scroll/focus at 390/402/430px.
- Visually inspected synthetic performance-return-390 screenshot; original contribution section remains on screen with no horizontal overflow.
- Local existing input-leave guard test passed; isolated helper probe passed exact sale currency, hidden-row exclusion and missing-row behavior.
- Pages run 38103947670 succeeded. Served HTML SHA256 matches implementation: 930376e6e8fe81e02219b909a721122246c0155e9dee1ca4c62b88d18ea29c9d.
- Real signed-in iPhone/Safari and account-filter continuity require separate verification; no actual user account writes are used. This is a verified synthetic return-flow fix, not completion of all native navigation scenarios.

Next priority: native Safari back navigation from detail (no popstate detail route found); design without losing drafts or exiting the app unexpectedly.
