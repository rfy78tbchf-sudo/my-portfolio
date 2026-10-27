# Build223 — 홈 차트 선택 해제

Baseline: main 186d503 (Build222). Pages succeeded and branch CI passed; main CI failed only while installing browser dependencies. Failed job retried, without duplicating the successful job. No open PR or newer active implementation found. Existing Build222 staged/unstaged files were preserved in the original checkout; this change uses a separate worktree.

## Candidates and selection

1. Home chart selection: source and synthetic mobile screen confirm date/value overlay remains after touch, with no clear action. Selected because it obstructs reading and has a bounded fix.
2. Portfolio readability: prior Build217/222 reading order remains; avoid another layout revision without evidence.
3. Period/detail return: existing trend suite covers retained periods and navigation; preserve and rerun.

## Change and acceptance

- Selecting a home chart point reveals a readable 44px-minimum `선택 해제` button inside the existing chart area. One tap dismisses date, amount, guide and selection dot. No added default text, vertical space or default action.
- Native vertical panning remains enabled (`touch-action: pan-y`); pointer cancellation clears the selection instead of leaving a stale overlay. Removed the redundant touchmove binding so cancellation cannot be followed by a legacy touch handler reopening the overlay.
- Preserve home assets → trend → composition, period selection, actual amounts, chart axes and detail disclosure. No moving averages on home. No production financial writes.
- Expanded isolated synthetic browser journey checks selection/clear/cancellation at 390/402/430px and 125% zoom, button bounds, overflow, period loading/failure/retry and return continuity. Chromium passed locally and the enlarged 390px screenshot was inspected. WebKit local launch is blocked by missing system libraries; required branch CI runs both engines before main promotion.
- Synthetic pointer cancellation verifies the handler, not physical iPhone momentum scrolling. Face ID, native keyboard and PWA termination/relaunch also remain device checks.

Next: require final branch CI, recheck unchanged main, promote, verify main CI/Pages and markers `2026-10-28-chart-clear-223` / `2026102802-223`. Then audit touch scrolling and return behavior without repeating the home-density redesign. Follow BUILD220 Standing UI content priority.

CI follow-up: WebKit caught synthetic mouse-leave after touch hiding the clear action. Removed automatic mouse-leave dismissal; explicit clear and pointer cancellation remain. The regression deliberately clears a touch selection with a mouse click as well. Require the corrected final commit to pass both engines.


## Deployment and follow-up audit — 2026-10-28 KST

- Final implementation commit: 710a516d61059e9128a137532216d99f8267569c. Required branch workflow 40539437325 attempt 2 succeeded, including Chromium/WebKit. Local d829cea has the identical tree; use the remote SHA for continuation.
- Rechecked main at 186d50340de721ca482bf5b24f99908b5a077b46 and fast-forwarded without force to the verified implementation. Pages run 40554202075 succeeded. Live HTML and service worker independently returned 2026-10-28-chart-clear-223 and my-portfolio-shell-2026102802-223.
- Main workflow 40554202971 was still running at this record; decision-regression succeeded. Check its final result next. This documentation-only follow-up is on the existing work branch and is not a new UI release.
- Follow-up candidates: (1) chart touch/clear and period loading continuity; (2) detail return location/currency; (3) daily resume preserving period/filter/input/scroll. Re-ran the Chromium trend journey at 390/402/430px and 125%, inspected the 390px enlarged selected-chart screenshot, and passed the return unit suite and Chromium daily journey. No additional reproducible UI defect found in these checks, so no speculative layout change.
- Local daily journey then could not launch WebKit because host libraries are missing; this does not replace the successful remote two-engine run. No production account data or writes were used.
- Next: check main workflow above; continue with stock-chart touch/zoom and latest-close/MA readability against existing tests, then selected-security completion/return. Do not reimplement home density or chart clear. Physical iPhone momentum scrolling, keyboard, Face ID and full PWA termination remain unverified.


## Continuation audit — 2026-10-28 KST (stock charts)

- Confirmed main remains 710a516. Main mobile workflow 40554202971 and Pages 40554202075 both completed successfully. Live HTML and sw.js return the Build223 markers above. No open PR or active implementation was found; reused the existing work branch.
- Documentation-only workflow 40554535532 failed during browser dependency installation before browser tests, while decision-regression passed. Retried only failed jobs (attempt 2); it was still running at this checkpoint. This is not a new production defect or release.
- Candidate review: (1) stock chart touch/zoom/latest-close and MA readability; (2) detail return preserving period/currency; (3) detail actions during text entry. Selected verification of (1) first because it is the recorded next action, with no speculative UI replacement.
- Existing Build90 synthetic Chromium journey passed at 360/390/430px, including real CDP two-finger pinch/pan, latest close outside visible range, selected date/value, MA isolation and period controls. A temporary variant also passed at 390/402/430px with CSS zoom 125%; inspected the enlarged 390px screenshot. No horizontal overflow or price clipping found. Temporary variant removed; no financial data or production writes used.
- Build169 chart preference and Build209 touch-return tests passed (period/currency/source identity). Build210 detail controls passed Chromium: reduced viewport save, text-entry footer suppression, blur recovery and reachable non-text actions. Local WebKit could not launch due to missing system libraries; the successful main remote two-engine suite remains the evidence for WebKit, not this local audit.
- Outcome: no reproduced defect justifying a UI/code change in the checked paths. No new deployment. Original user captures were not reread in this verification-only run; no capture-based layout claim is made.
- Next: inspect attempt 2 of 40554535532 and this documentation commit's workflow before any promotion. Continue selected-security decision completion/return using synthetic full journeys; verify 390/402/430px and enlargement if making changes. Stock chart clear returns via period selection; do not add duplicate controls without a demonstrated benefit. Physical iPhone scrolling, keyboard, Face ID and PWA termination/relaunch remain unverified.

## Continuation audit — 2026-10-28 KST (decision completion)

- Main is still 710a516; mobile CI 40554202971 and Pages 40554202075 succeeded. Previous documentation CI 40554535532 (retry) and 40558603920 also succeeded. No open PR or active run among the latest runs; continued the existing work branch. Live HTML and sw.js still return Build223 markers.
- Candidates (maximum three): (1) confirmed save → one completion action → list → next-visit exact readback; (2) lost receipt → original-request retry without duplicate save; (3) contribution/detail return preserving selection and origin. Selected (1)/(2) as the recorded next audit and because ambiguous completion can cause repeated submission. No speculative layout replacement.
- Production-startup synthetic decision browser journey passed Chromium at 390px normally, then 390/402/430px at 125% CSS zoom using a temporary harness variant. Exact reasons/checkpoints, comparison history, single completion footer, next-visit review, lost receipt, retry payload identity, and draft write failure recovery passed. Inspected normal reopened review and enlarged pending-retry screenshots. The temporary variant was removed. This is browser enlargement, not physical iPhone accessibility certification.
- Build199 contribution return, Build208 list return, Build206 next action and Build209 next-review suites passed. Existing paths already preserve origin and replace duplicate completion controls; no extra taps or navigation changes were justified.
- Reopened two October 26 user captures privately and compared review/pending-state content against current synthetic screens. The repeated generic review explanation in the older capture is already disclosed by Build220; do not reopen that completed task. Captures and personal values were not committed. Library image-read initially returned no pixels; materialization succeeded, enabling actual visual inspection.
- Local WebKit launch remains blocked by missing host shared libraries. The same application code has passed remote Chromium/WebKit in 40558603920; this run's enlarged variants were Chromium only. No production database writes. Actual iPhone keyboard, Face ID, full PWA termination and momentum scrolling remain unverified.
- Outcome: no reproduced app defect or evidence-based layout change in these journeys; no new UI build/deployment. Next: inspect analysis allocation-list navigation and portfolio search/filter return with synthetic data, comparing current behavior before proposing density changes. Do not repeat completed home/chart/manual-guidance work. This documentation commit can remain on the existing work branch until the next verified implementation; check its CI first.
