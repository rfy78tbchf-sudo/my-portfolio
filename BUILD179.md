# Build179 — Keep acknowledged review evidence quiet on revisit

Baseline main: 64c5442126ac83e4fd1392f8bf44d8cd70d53848 (verified Build178).

## User-facing flow

Home review cards with a reached owner condition or new relevant official evidence now offer “이 자료 확인했어요”. This records an explicit acknowledgement of the displayed evidence on this device, scoped to the signed-in account and security. Merely opening home or detail never acknowledges anything. The saved investment decision, transactions, holdings and cash are untouched.

Acknowledged evidence is removed from urgent review counts and the default auto-expanded queue. The item remains available in saved judgments, shows its checked time, and offers “다시 점검 목록에 넣기”. After reload, the same evidence stays acknowledged. A new/corrected qualifying close, a changed saved judgment, or another verified relevant document returns the reminder. Date-based conditions do not reappear solely because another day passed. Distinct official documents are all included; ordering and duplicates do not create extra reminders. Missing quote data stays unknown rather than becoming cleared.

Account isolation reuses the authenticated local key namespace already used for drafts. Failed local storage writes leave the reminder visible with an inline retry message. A stale action from a different signed-in owner cannot write into that owner's state. This is device-local, not cross-device acknowledgement; browser data deletion clears it. No new server/DB maintenance is required.

## Verification

78 isolated tests passed (8 new acknowledgement cases plus 70 existing condition cases). Existing home/detail parity, home context, priority/holding scope, official evidence, review-list bounds and script/sync checks passed. Synthetic browser journey added for 390/402/430px: check → zero decision writes → full reload → still checked → undo → check again → new quote restores the reminder. Full mobile CI and deployment passed; details below.

## Status and next priority

Implementation, isolated checks and synthetic mobile verification complete; deployment is verified below. Actual signed-in iPhone/PWA operation remains 확인 필요. Acknowledgement is not an assessment that the investment is safe or a new hold decision. Current limitation: each new qualifying daily close is new evidence and can prompt a new review; no indefinite snooze or threshold-episode suppression is inferred. Next priority is measuring first open/revisit/refresh and the daily home journey, rather than adding analysis features. The 30-second/one-minute usability goals remain unmeasured.

## Final verification — 2026-10-10

- Behavior commit d5e26cc011135f70d1c708e5beb0686ac8ac2fc3. Full mobile run 38049992455 / job 114207014344 succeeded; artifact 11668738653.
- Reviewed 390px checked-state screenshot: reason/checkpoint/observed quote stay visible, checked time and undo are readable. All 390/402/430px browser assertions passed, including zero synthetic decision writes and restart persistence.
- Text-only follow-up 13929eecc28a8a5825f5520476f8b1b410e730bb clarifies that either failed check or failed undo preserves the previous display. Eight acknowledgement tests and script/sync checks reran successfully; full mobile suite was not rerun for this copy-only change.
- Pages 38049992253 (behavior) and 38050187227 (copy follow-up) succeeded. Final source SHA-256 242fad06d2e1a2853b2d1b2059772b6e6e5fa5442a13453a05cd4f74ee06c7e9; live match checked after deployment.
- Only isolated synthetic data was used for writes. No real user judgment or transaction was created. Actual iPhone and measured daily usability remain unverified.
