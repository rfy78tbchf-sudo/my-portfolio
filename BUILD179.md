# Build179 — Keep acknowledged review evidence quiet on revisit

Baseline main: 64c5442126ac83e4fd1392f8bf44d8cd70d53848 (verified Build178).

## User-facing flow

Home review cards with a reached owner condition or new relevant official evidence now offer “이 자료 확인했어요”. This records an explicit acknowledgement of the displayed evidence on this device, scoped to the signed-in account and security. Merely opening home or detail never acknowledges anything. The saved investment decision, transactions, holdings and cash are untouched.

Acknowledged evidence is removed from urgent review counts and the default auto-expanded queue. The item remains available in saved judgments, shows its checked time, and offers “다시 점검 목록에 넣기”. After reload, the same evidence stays acknowledged. A new/corrected qualifying close, a changed saved judgment, or another verified relevant document returns the reminder. Date-based conditions do not reappear solely because another day passed. Distinct official documents are all included; ordering and duplicates do not create extra reminders. Missing quote data stays unknown rather than becoming cleared.

Account isolation reuses the authenticated local key namespace already used for drafts. Failed local storage writes leave the reminder visible with an inline retry message. A stale action from a different signed-in owner cannot write into that owner's state. This is device-local, not cross-device acknowledgement; browser data deletion clears it. No new server/DB maintenance is required.

## Verification

78 isolated tests passed (8 new acknowledgement cases plus 70 existing condition cases). Existing home/detail parity, home context, priority/holding scope, official evidence, review-list bounds and script/sync checks passed. Synthetic browser journey added for 390/402/430px: check → zero decision writes → full reload → still checked → undo → check again → new quote restores the reminder. Full mobile CI and deployment pending.

## Status and next priority

Code and isolated verification complete; mobile and deployment results recorded below when complete. Actual signed-in iPhone/PWA operation remains 확인 필요. Acknowledgement is not an assessment that the investment is safe or a new hold decision. Current limitation: each new qualifying daily close is new evidence and can prompt a new review; no indefinite snooze or threshold-episode suppression is inferred. Next priority is measuring first open/revisit/refresh and the daily home journey, rather than adding analysis features. The 30-second/one-minute usability goals remain unmeasured.
