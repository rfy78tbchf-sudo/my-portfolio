# Build218 — 판단 입력과 재시도 화면을 먼저 표시

Baseline: main c18bb9e7a8356b8f7312ce8d5ce08d1d2d066c04 (Build217).

## Evidence and change

The six user-provided October 26 iPhone captures establish current home, holdings, performance, allocation and judgment-review appearance. IMG_9597 shows a pending-save footer while the current form begins below a long saved review, at the footer boundary. A read-only production query confirms the displayed RXRX reason and condition exist in a saved judgment. It does not identify the device's pending request, and does not establish that the pending draft is the same record.

- Opening or restoring a judgment form puts it before saved judgment content. A delayed history/analysis response appends review controls after the editor, preserving input focus and position.
- The editor has a short heading distinguishing ordinary input from a submission awaiting confirmation. Exact request identity and full-content readback rules are unchanged; no automatic writes or draft deletion were added.
- Opening an editor scrolls immediately to its input. The bottom save action scrolls directly to a missing required field.
- The detail sheet uses its fixed modal's height rather than an independently zoomed viewport height. This fixes an observed 125% zoom case where the bottom save button was outside the viewport. Controls have header/footer scroll margins.
- Build marker and service-worker cache advance to 218.

## Verification at implementation

- 121 focused regression cases passed locally, covering saved decisions, late responses, draft isolation, retry identity, daily access, return actions and provisional P&L presentation.
- Chromium: 390/402/430px editor order and focused control bounds, delayed review while editing, retained input focus/position, and 125% enlarged required-field navigation passed.
- Chromium: manual/comparison save, page recreation, receipt loss, original-payload retry and duplicate prevention passed using isolated synthetic routes. No production judgment was written.
- The extended mobile test fails on the previous main because the focused choice is not clear of the header/footer.
- The existing mobile workflow runs these extended browser checks in Chromium and WebKit before promotion.

Physical iPhone Face ID, native keyboard and home-screen termination/relaunch remain user-device checks. The captured period result is explicitly partial (12 of 13 securities, 5 estimated); this release does not certify its source completeness or change financial calculations. No database schema, authorization, AI or account data was changed.
