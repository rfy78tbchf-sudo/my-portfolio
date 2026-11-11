# Build220 — 판단 정보 우선, 반복 안내는 펼쳐보기

Baseline: main 19983699a5c45a41ef0b90e8342ae2bf74a828dc (Build219).

## User-visible result

The supplied iPhone review capture showed a general instruction below the review status and another long explanation below the user's checkpoint. Both competed with the saved reason and the next action.

- Keep the review state, saved choice, user's reason and checkpoint in the primary view. Remove the redundant instruction that merely restated the next action.
- Fold the explanation of manual checkpoints into **판단 근거 자세히**, together with existing source evidence. MA comparison limitations also belong there; the comparison result stays visible.
- A failed refresh still has a visible retry instruction. Confirmed quantity changes, met price conditions and relevant new official evidence stay in the primary review even when the user's checkpoint is manual.
- Fold input instructions into **조건 입력 도움말**. The checkpoint retains its accessible description, and the disclosed text remains available.
- Shorten save confirmation and remove the generic paragraph above the already-labelled decision form. Successful save confirmation and failed/pending save actions remain visible.
- Secondary disclosure labels use restrained typography with a minimum 44px touch target. Build/cache advance to 220.

## Standing UI content priority

Future changes should keep information needed for an investment decision and the next action visible. Calculation implementation, settlement mechanics, repeated guidance and background qualifications belong in optional details. Do not make data loss, save/login failure, an unresolved submission or a materially incomplete amount inconspicuous. Keep secondary content readable and operable; do not hide it through tiny text or low opacity. Home remains assets, trend and allocation; security review belongs in the selected security.

## Verification

126 local focused regression cases pass: manual versus structured checkpoints, cross-account draft isolation, save confirmation, late callbacks, reload and exact edited content. Added checks distinguish hidden generic explanation from visible refresh/quantity/price/evidence changes. Browser checks require explicit expansion to read secondary guidance and preserve exact saved checkpoint text on edit. Detail scenarios run at 390/402/430px, with 125% enlargement and touch-target checks. The existing remote workflow verifies Chromium/WebKit and the wider mobile/decision regressions before main promotion.

All browser writes use isolated synthetic routes. This release does not alter financial calculations, account data, authorization or request identity. Physical iPhone Face ID, native keyboard and full PWA termination/relaunch are not certified by browser emulation.
