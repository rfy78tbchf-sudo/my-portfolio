# Build189 — Validate back navigation with WebKit and account filters

Baseline: Build188, 3c6bade. No production behavior change planned; verify existing behavior rather than rebuild it.

Current primary performance page is explicitly scoped to KB brokerage equities. Account selection exists in the legacy per-sale ledger section, not as a primary performance account switch. Added focused WebKit tests using that actual selector and handler: choose another synthetic account and 3M, open detail, edit a decision draft, redraw the background, browser back, verify account/period/scroll, reopen draft, close with in-app return and check no decision writes.

Tests use actual app HTML/handlers and isolated synthetic data at 390/402/430px. WebKit is not physical iPhone Safari/PWA and cannot validate a partially canceled edge swipe. Verification completed:
- Full workflow 38108460467 passed on e911629a901472b6e6c006919f2fd628f25dcbac, including existing Chromium suite and focused WebKit run at 390/402/430px.
- WebKit verified second account + 3M survive background render, browser back and explicit return; scroll returns within 3px; exact draft reason/condition restore; zero decision writes.
- Visually inspected webkit-account-return-390.png with the selected synthetic account and period visible.
- Initial WebKit run waited on a hidden selector because its containing disclosure was closed. Fixed test to open actual ancestor summary controls; no production app defect identified.
- Served production HTML still matches Build188 SHA256 a7c2b5d017e9b64ae7f4ba166751ee990c5bbdd8b161111db35b7f9cd09a447c. No UI/financial behavior was changed in this verification stage.

Status: automated and synthetic mobile navigation verified. Physical iPhone Safari edge-swipe cancellation and standalone PWA remain confirmation-needed. Account selection coverage refers specifically to legacy per-sale ledger; primary performance remains KB brokerage scoped.

Next priority: everyday home freshness and failure recovery readability using current implementation; avoid repeating this return-flow work without new evidence.
