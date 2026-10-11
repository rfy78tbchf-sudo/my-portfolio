# Build187 — Resume the originating stock after a background refresh

Baseline: Build186, e45c40f (latest main verified before edits).

Existing normal detail close restores scroll and retains the performance view; no filters were rebuilt. Found a gap: background render replaces the original button, so close skips focus restoration when its saved node is disconnected. Resolve the equivalent visible button in current content using its exact stock/action identity, including sale currency. Keep preventScroll and existing return position. If the row no longer exists, do not focus a different stock.

Mobile test simulates background replacement while detail is open, then uses the bottom return button and checks selected performance, scroll and focus at 390/402/430px. Existing close, judgment draft/save/revisit tests remain.

Verification pending. Real signed-in iPhone/Safari and account-filter continuity require separate verification; no actual user account writes are used.

Next priority: native Safari back navigation from detail (no popstate detail route found); design without losing drafts or exiting the app unexpectedly.
