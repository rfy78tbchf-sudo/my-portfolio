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
