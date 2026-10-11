# Build188 — Browser back closes detail and retains decision drafts

Baseline: 965e684 (Build187).

Add one same-document history entry per detail journey, including sale review. Back runs the existing draft/unsaved-input guard and close restoration. Cancellation restores the entry. Explicit close consumes its entry; rapid reopen is handled after pending history traversal. Next/previous stock does not stack entries. Stale forward/reload markers are removed rather than reopening private records. History contains only a runtime marker, no stock, account, draft or financial values. Existing state keys are preserved.

Verification pending: isolated history lifecycle tests plus synthetic mobile back with an edited judgment draft, reopening, no decision write and full reload. Real Safari edge-swipe and standalone iPhone behavior remain confirmation-needed.

Next priority: test actual iPhone back/return and account-filter combinations; do not claim native-device completion from Chromium alone.
