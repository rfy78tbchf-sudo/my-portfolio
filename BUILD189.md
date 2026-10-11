# Build189 — Validate back navigation with WebKit and account filters

Baseline: Build188, 3c6bade. No production behavior change planned; verify existing behavior rather than rebuild it.

Current primary performance page is explicitly scoped to KB brokerage equities. Account selection exists in the legacy per-sale ledger section, not as a primary performance account switch. Added focused WebKit tests using that actual selector and handler: choose another synthetic account and 3M, open detail, edit a decision draft, redraw the background, browser back, verify account/period/scroll, reopen draft, close with in-app return and check no decision writes.

Tests use actual app HTML/handlers and isolated synthetic data at 390/402/430px. WebKit is not physical iPhone Safari/PWA and cannot validate a partially canceled edge swipe. Results pending.
