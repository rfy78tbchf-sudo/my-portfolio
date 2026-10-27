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
