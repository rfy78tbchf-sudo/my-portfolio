# Build176 — Continue an unfinished decision after browsing another holding

Baseline: main 17601322042dd79e56ed3204cd274078ef099ed3 (Build175 code and verified mobile workflow). No prior balances or screenshot values are reused as current account data.

## User-facing change

An edited decision now survives the previous/next holding controls, closing to the list, and reopening that holding in the same running login session. Restore the exact choice, reason, checkpoint and comparison inputs, including intentional blanks and a zero-percent target. Open the restored form and identify it as an unsaved draft. An explicit confirmed discard removes that draft only; saved history is unchanged.

Comparison outputs and AI evidence are not restored. A retained target requires recalculation with current data; no past scenario is silently attached to a new judgment. Other forms (holding thesis, sale review, etc.) keep their existing unsaved-change confirmation. This is a decision-draft change, not a claim that every form now persists.

## Save and account boundaries

- Drafts stay in memory; no server write, localStorage, transaction or holding change occurs on navigation.
- Drafts are scoped by security ID and authentication epoch. Logout clears them. A new login epoch cannot restore a previous session's draft.
- While a save/readback is pending, show a short message and keep the current detail until that request finishes. This avoids losing receipt tracking through navigation.
- Preserve retry request identity for unchanged plain decisions after a failed save. If loaded history already contains the confirmed request and unchanged submitted text, do not revive it as an unsaved draft.
- Remove the completed draft only after the existing exact readback verification. A newer edit made during a save remains dirty and survives later navigation.

## Validation

86 targeted isolated assertions passed, including 12 new draft/navigation/account/discard/receipt cases. Existing detail dirty-state and refresh/scroll regression checks also passed. The extended 390/402/430px synthetic mobile journey now navigates to a second holding, writes a separate draft, returns to the first, closes/reopens from the home list, verifies zero writes until Save, saves/readbacks and reopens the saved judgment. CI result is recorded after completion.

## Remaining scope

Actual iPhone/PWA behavior and owner-account end-to-end usage still need confirmation. Drafts do not survive a full page reload, app process termination or logout; durable authenticated draft storage is not implemented in this iteration. No claim is made about the 30-second/one-minute usability goals. Next priority: fast reopening/return behavior and deliberate persistence of unfinished work across app restarts, with account isolation and stale-data checks.

## Final verification — 2026-10-10

- Production code commit c2b1a7eaa954f396a8b46d465df93350a2ff8d91; test-only follow-up edb6a86b8907266bc4a03f42e84fb6fa001c7075.
- Pages deployment run 38028610342 succeeded. Deployed index and local source matched SHA-256 af7163c4c3c755e57a08ad14a38e83b2afbd25baf125fb08f5f4be4c67195bde.
- Full Mobile portfolio layout run 38028731854 / job 114145014242 passed. Screenshots artifact 11661112481 includes decision-draft-restored at 390/402/430px.
- Initial mobile run exposed legacy discard-on-navigation expectations and shared authentication epochs between independent fixtures. Follow-up makes each independent fixture a fresh login, asserts real navigation retention within the same fixture, and explicitly checks cancel/confirm on draft discard.
- Verified scope: synthetic mobile journey and production source deployment. Real-account iPhone completion and durable restart recovery remain unverified/unimplemented respectively, as described above.
