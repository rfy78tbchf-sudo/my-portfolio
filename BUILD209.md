# Build209 — Resume the daily review without losing the current task

Baseline: Build208, main `1b8ed42887c1f9017bd89c09285b153e0770c0d2`.
Build marker: `2026-10-19-daily-journey-209`.

## Changes

### 1. Launch, resume and return

The existing session recovery and throttled saved-data refresh now cover home, holdings and performance. Focus, page restoration, restored connectivity and visible-page events share the same in-flight work. The existing three-minute refresh limit and Korean-date invalidation still apply.

Automatic refresh waits while a security detail is open or a main-screen input is active, then resumes after closing detail or leaving the input. If a data request started before typing began, its response also defers the background redraw until typing ends. Intentional tab and select changes still render immediately.

Touch entry from contribution leaders, performance rows, saved judgments and sale reviews explicitly records the originating control. A replaced list resolves the same security within the original section. The same security appearing in another home section cannot steal the return focus. Existing search, filters, period, expanded sections, scroll and the brief return highlight remain in place.

Navigation caches only successful app-shell responses. A network failure or HTTP 5xx can use a previously successful shell without replacing it with an error page. HTTP 4xx responses keep their original meaning. Applying a new app version remains explicit so an unsaved judgment is not discarded by an automatic reload.

### 2. Read performance during refresh

After a new balance observation, keep the selected period's previous total or realized result only when owner, account set, Korean date and selected period match. Label it `이전 조회` while recalculating, or `이전 조회 · 갱신 실패` with retry if the new read fails. New observations still get a fresh calculation cache.

Never combine retained old totals with new realized components. A request completing after Korean midnight invalidates the prior-day result and allows the current day to be fetched instead of leaving a permanent loading state. Partial calculations retain their partial status, including the context carried into security review.

The compact Build207 summary and restored Build201 home navigation remain. This release adds no extra home performance selector or duplicate performance button.

### 3. Finish and revisit a judgment

When a saved judgment exists and there is no unfinished comparison or input step, the detail footer offers `지난 결정과 이후 변화 보기`. A security without a holding reason starts with `먼저 보유 이유 적기`.

A failed judgment-history read is distinct from an empty history. The header, history section and footer offer `저장한 판단 다시 불러오기`; retry reads the existing records and cannot create a judgment or request a new AI answer. In-progress comparison, form, save and completion actions retain their priority.

## Verification

- Targeted Node regressions cover resumed-session event deduplication, input/detail deferral, Korean midnight, owner/account isolation, retained-result success/failure/retry, section-specific return focus, next-step selection and successful-shell fallback.
- The existing production-screen browser suite passed in Chromium at 390, 402 and 430 px, including large-text layout, list return, drafts, synthetic judgment save and a fresh-page reread of the saved reason and review condition. Failed-history read, failed retry and successful retry are also asserted without a new judgment or AI request.
- The existing WebKit navigation suite passed at 390, 402 and 430 px for list return and draft continuity.
- An independent daily-journey browser test passed in Chromium and WebKit at 390 × 844. It runs the production HTML and session/authentication/data-loading code with every network request replaced by an isolated synthetic response. It verifies stored-session launch, all three screens, a delayed resume response during typing, blur-triggered redraw, retained partial performance, preserved period/filter/search/scroll, and a detail draft reopened after the deferred refresh.
- The CI workflow repeats the new Node regressions and browser daily-journey checks on every main-branch push. Screenshots use synthetic account and judgment data.

## Remaining acceptance on the user's iPhone

Browser automation does not establish Face ID behavior, home-screen app termination/relaunch, software-keyboard positioning, or live account latency on a physical iPhone. The final short flow remains: open the app, review assets and performance, enter a holding, return to the same list, then save one real user judgment and revisit it after relaunch.

No production account manipulation, user judgment creation, new AI response generation, database migration or broad transaction recovery was performed for this release. Existing transaction ordering, cost and settlement gaps remain data-completeness work; an internally reconciled subtotal is not a complete account return.
