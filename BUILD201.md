# Build201 — Revert home toolbar and recover interrupted login

User direction: remove Build200's home period selector/stock-P&L button; performance tab is sufficient. Restored Build199 home controls and its browser assertions. Earlier Build198/199 period routing and filtered return remain.

Roadmap item 2 audit found an expired saved session that failed refresh due to connectivity stayed at login after connectivity recovered. Existing focus/visibility handlers only acted in live mode, and the message required manual reload.

Retry a pending interrupted login on online, pageshow, focus or visibility return, only while login is visible and browser is not offline/hidden. A shared restore promise coalesces events. Valid stored sessions retain the immediate-start path. Terminal rejection still requires login and is not retried indefinitely. Refresh responses are scoped to the requesting auth epoch and refresh token so old success/failure cannot replace or clear a newer login. No session TTL, authentication policy or token logging changes.

Synthetic production-function tests pass transient failure/recovery, each resume event, deduplication, hidden/offline guards, terminal expiry and changed-login isolation. Existing quick-return/date rollover/failed-lane recovery and controlled timing checks run separately. These are not authenticated physical iPhone speed or Face ID measurements. No owner decisions or account writes. CI and deployment verification pending.

Reviewed Supabase changelog and current session documentation (https://supabase.com/docs/guides/auth/sessions); existing refresh endpoint and rotation remain unchanged. No applicable breaking API change identified for this frontend retry fix.

Item 2 remains partial: real-device first open, Face ID, standalone resume and end-to-end latency must be measured when a physical authenticated session is available. Do not label synthetic timing as an actual iPhone improvement. The supplied screenshot verifies Build200 was visible on the user's device, not its load duration or financial completeness.
