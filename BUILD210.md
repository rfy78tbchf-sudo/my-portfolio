# Build210 — Keep the current review context visible

Baseline: Build209, main `96aa92f2e122ab21a1589f8f5ad129cbb43b97dc`.
Build marker: `2026-10-19-review-continuity-210`.

## What changed

### Stay at the asset trend when changing its period

Previously, choosing a period in the home asset trend immediately scrolled to the top and removed the trend while its request was pending. In isolated 390 px browser reproduction, scroll positions around 1190 px became zero in both Chromium and WebKit and stayed there after completion.

The home now keeps its sections and the trend location during that request. It shows the selected period's loading or failure state in the trend, with retry in the same section. Old-period numbers and charts are hidden while the new period is unavailable. The visible trend or period-control position is preserved when loading, retrying and applying a response. A late response does not pull someone back from another tab.

Period strips also reveal their selected button after rendering by changing horizontal scroll only. For example, selecting `전체` no longer recreates the strip with the selected button outside a 390 px screen. The existing home shortcuts and single home period strip remain; duplicate home performance controls were not added.

### Keep input and save actions usable

The next-action grid previously overrode the intended text-entry hiding rule. Correct the CSS priority and limit hiding to text-entry fields, while checkbox, radio, range, select and date controls keep the return and next-action buttons available.

The bar is hidden without removing its layout space. This prevents WebKit from moving a form's inline save button between pointer press and release when focus leaves a text field. The focused text, the inline save click and the restored action bar are checked together at normal and reduced viewport heights.

### Carry the meaning of a number into the next screen

- A computed won amount can still be provisional before settlement. Show `결제 전 잠정` in the period summary, affected contribution leaders and affected stock amounts, even when another stock remains uncalculated. Count only provisional items with displayed amounts; unpriced records are not described as included money.
- Preserve the partial and provisional states when opening security detail. For foreign realized results, keep the foreign-currency amount shown in the originating list instead of silently replacing it with a won amount whose sign may differ.
- Replace `계좌 데이터 정상` with the specific `원장 수량 대조` count. Zero matched out of zero is no evidence of a normal account. Settlement-pending cases remain visible even when all compared quantities match.

No amount, calculation formula, server completeness flag or production data was changed. This release does not resolve the remaining trade-order, cost, FX or settlement evidence gaps.

## Verification scope

- `tests/build210_trend_browser.mjs`: production startup, authentication/data-loading paths and renderers with every network request replaced by isolated synthetic responses. Chromium and WebKit at 390 px cover trend loading, failure, retry, stale responses, navigation during a request, and selected-period visibility.
- `tests/build210_detail_controls.mjs`: production CSS and detail markup with isolated controls. Chromium and WebKit cover text entry, non-text control focus, action recovery, reduced viewport height and an inline save click while leaving text entry.
- `tests/build210_pnl_state.mjs`: production display functions cover priced provisional items mixed with uncalculated items, zero amounts, full calculation coverage, mixed currencies, realized-detail context and quantity reconciliation. Rendering must not mutate the server response.
- The existing mobile suite also checks provisional labels in a three-contributor first screen and after opening security detail. Its realized-detail expectation now matches the foreign amount shown in the list.
- The CI workflow runs these checks alongside the existing saved-decision, resume, list-return and daily-journey regressions.

Local verification passed before publishing:

- Full Chromium mobile suite at 390, 402 and 430 px, including 125% zoom, provisional-result layout, detail context, saved-decision reload and failure recovery.
- WebKit list and draft navigation at 390, 402 and 430 px.
- Production-startup daily journey, trend continuity and detail-control checks in both Chromium and WebKit at 390 px.
- The six Build209/210 resume, refresh, revisit, return, shell-recovery and P&L-state regression files. Relevant existing home-period tests also passed.
- `git diff --check`.

All screenshots and new browser responses are synthetic. No real account manipulation, user judgment creation or new AI response generation was performed. Face ID, actual home-screen app relaunch, native keyboard behavior and live latency on the user's physical iPhone remain separate acceptance checks.
