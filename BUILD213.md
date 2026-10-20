# Build213 — Assets, trend, then a deliberate security review

Baseline: Build212 / `15f8ed37838c112275260858b48a2e7eeac0ff37`. Both remote main and the deployed HTML had this baseline at start.

Build: `2026-10-20-asset-review-213`. Cache: `my-portfolio-shell-2026102002-213`.

## Reviewable design alternatives

- [Three interactive synthetic concepts](docs/ui-concepts.html): A composition map; B one-security review; C decision timeline. Each uses the same fictional account, period, and mobile dimensions. Local prototype actions cannot call production services.
- [Before / after review](docs/ui213-review.html): actual production renderers using identical isolated synthetic responses at 390 × 844. Account values and owner notes from the reference images are not used.
- B is the implementation direction: it makes the next action explicit without requiring prior decision history. A remains better for spatial composition exploration; C remains better for historical reflection. Neither is installed as another production menu.

## Changes

The home now renders assets → trend → focused security review → expandable prior judgments → holdings. The repeated shortcut row is removed. The chart has one period selector, a signed asset change, and an explicit “입출금 포함” label. This is not investment P&L. No principal line, inferred return, or invented observation was introduced. Existing chart selection, loading, retry and continuity handlers remain.

Account timestamps and period calculation evidence remain in the account disclosure. Chart range and source information share one “추이 상세” disclosure. Today’s P&L remains in a separate disclosure lower on home. Last-known startup content is still labeled and now reserves a trend-loading section before holdings.

The new review card aggregates securities across accounts, excludes non-held positions, uses only the latest saved condition per security for initial ordering, and otherwise sorts by name. The owner’s explicit browsing choice overrides the initial ordering and is stored under an owner-scoped local key. Leaving or returning to the card never saves a decision or acknowledges evidence. A sold/missing security falls back to a current holding. Storage failures are explicit. Fresh official-evidence review remains in the existing expandable judgment section; the new cursor does not claim to rank by it.

The main action opens the existing detail and saved-review flow with its decision identity and context. Existing actual-save confirmation, interrupted-save recovery, drafts, list return and exact next-runtime readback are preserved. Failed/unfinished history loading is not described as “no saved judgment.” Comparison assumptions and saved timestamps are in “비교·저장 정보”; current reason and review condition stay prominent.

Navigation is 자산 / 내 종목 / 손익 / 분석 / 더보기. Existing portfolio controls, prices, list density and filter/scroll state remain. “일부 계산” becomes “일부 미계산”; “결제 전 잠정” becomes “추정”, still adjacent to affected amounts. Detailed settlement explanations remain available. Calculation values, coverage flags and aggregation scopes are unchanged.

## Verification

All browser fixtures intercept requests locally. No real account judgment, model call, order, or test record is written.

- `build213_browser`: Chromium and WebKit, 390 / 402 / 430px, asset/chart/review ordering, first-screen action, four holdings, partial totals, owner browsing persistence after reload, detail return, 125% zoom and no decision writes.
- `build213_review_cursor`: latest-condition priority, account aggregation, non-held positions, owner isolation, stale cursor, escaped text, loading/failure history and read-only rendering.
- `build209_daily_browser`: production startup/authentication path, delayed refresh, filter/input/period/scroll and draft preservation in both engines.
- `build210_trend_browser`: loading/error/retry, stale response suppression, active period and navigation continuity in both engines. Assertions about being >500px down the old home are replaced with actual control-position continuity.
- `build210_detail_controls`: text input hides the footer, non-text controls retain actions, blur recovery and reduced viewport save in both engines.
- `build211_decision_browser`: exact manual/comparison payload and new-page readback, lost response, failed reads and original-request retry in both engines.
- Focused Node run: 50 passing tests covering uncertainty display, saved payloads, request identity, races, period scope and new browsing behavior.
- Three synthetic concepts: open, input, simulated save and return verified. Before/after capture uses the same fixture and period.
- Full `build67_ui_visual` Chromium journey passed at 390 / 402 / 430px including 125% enlargement, long names, large amounts, chart touch, forms, save/readback and return. WebKit navigation passed at all three widths. A separate Node regression run passed 74 tests.
- Existing visual suite retains numeric, save, filter and return assertions. Only obsolete presentation assumptions change: chart order, collapsed evidence, removed shortcuts and renamed uncertainty labels.

Physical iPhone Face ID, home-screen relaunch, native keyboard and live account latency are not certified by these browser tests. No database/SQL migration is part of this release.
