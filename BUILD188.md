# Build188 — Browser back closes detail and retains decision drafts

Baseline: 965e684 (Build187).

Add one same-document history entry per detail journey, including sale review. Back runs the existing draft/unsaved-input guard and close restoration. Cancellation restores the entry. Explicit close consumes its entry; rapid reopen is handled after pending history traversal. Next/previous stock does not stack entries. Stale forward/reload markers are removed rather than reopening private records. History contains only a runtime marker, no stock, account, draft or financial values. Existing state keys are preserved.

Verification:
- Full Mobile portfolio layout run 38104599176 passed on ed84b7dfa2d6c387b8a21b58a5e66a429b7bab82 at 390/402/430px. Edited draft → browser history.back → closed modal → reopen → exact reason/condition retained, no decision write, and full reload tests passed.
- Isolated tests cover one entry per stock journey, cancel, explicit close, rapid reopen, stale forward/reload markers and preservation of other history state.
- Visually inspected browser-back-draft-390: restored choice and reason readable; persistent return button visible.
- Initial full run stopped in the isolated update-notice test because detail initialization was placed in its extracted source section. Moved initialization before login startup; update-notice unit and full suite passed.
- Served production HTML SHA256 equals local implementation: a7c2b5d017e9b64ae7f4ba166751ee990c5bbdd8b161111db35b7f9cd09a447c.
- All test records synthetic; no user-account judgments/trades inserted.
- Real Safari edge-swipe, canceling a partial swipe, and standalone iPhone behavior remain confirmation-needed. Chromium history tests do not establish native-device completion.

Next priority: test actual iPhone back/return and account-filter combinations; do not claim native-device completion from Chromium alone.
