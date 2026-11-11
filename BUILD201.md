# Build201 — Revert home toolbar and recover interrupted login

User direction: remove Build200's home period selector/stock-P&L button; performance tab is sufficient. Restored Build199 home controls and its browser assertions. Earlier Build198/199 period routing and filtered return remain.

Roadmap item 2 audit found an expired saved session that failed refresh due to connectivity stayed at login after connectivity recovered. Existing focus/visibility handlers only acted in live mode, and the message required manual reload.

Retry a pending interrupted login on online, pageshow, focus or visibility return, only while login is visible and browser is not offline/hidden. A shared restore promise coalesces events. Valid stored sessions retain the immediate-start path. Terminal rejection still requires login and is not retried indefinitely. Refresh responses are scoped to the requesting auth epoch and refresh token so old success/failure cannot replace or clear a newer login. No session TTL, authentication policy or token logging changes.

Synthetic production-function tests pass transient failure/recovery, each resume event, deduplication, hidden/offline guards, terminal expiry and changed-login isolation. Existing quick-return/date rollover/failed-lane recovery and controlled timing checks run separately. These are not authenticated physical iPhone speed or Face ID measurements. No owner decisions or account writes. CI and deployment verification completed below.

Reviewed Supabase changelog and current session documentation (https://supabase.com/docs/guides/auth/sessions); existing refresh endpoint and rotation remain unchanged. No applicable breaking API change identified for this frontend retry fix.

Item 2 remains partial: real-device first open, Face ID, standalone resume and end-to-end latency must be measured when a physical authenticated session is available. Do not label synthetic timing as an actual iPhone improvement. The supplied screenshot verifies Build200 was visible on the user's device, not its load duration or financial completeness.


## Verification completed

Implementation 0751930a3067342c51a066031d4529277e3bce0f. Mobile workflow 38193588171 succeeded, including synthetic auth recovery tests, Chromium 390/402/430px flows, existing WebKit navigation and chart checks. Pages run 38193587697 succeeded. Production index SHA256 matches local: 951cb9ed5b0a93611873c4b3fd9db9b091d1da11b9a5785fccf538d9c9f2f2cd.

The login recovery cases execute the production functions with synthetic token responses; they do not demonstrate a live Face ID or real provider session. Controlled loading tests continue to verify staged rendering and caching, but no end-to-end iPhone latency improvement is claimed. Step 2 is in progress, not complete. User rejected the Build200 home toolbar; do not reintroduce duplicate home controls in later usability work.
