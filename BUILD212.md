# Build212 — Clearer daily screens and readable mobile controls

Baseline: Build211, main `2d405af6d94d53cb5aaf51c03731785eccd32935`.

Build marker: `2026-10-20-ui-clarity-212`.
Service worker cache: `my-portfolio-shell-2026102001-212`.

## UI changes

### Assets and holdings

The account and sort settings had inherited a two-column layout intended for an older search toolbar. The settings form was trapped inside its 112px side column, clipping selected values to a few characters. The disclosure now uses the available width, with separate full-width account and sort fields on small screens. The fields use 16px text and 48px touch areas, and all three market choices remain readable.

Holding names, quotes and metadata share a steady left edge, with value and P&L aligned on the right. The layout adapts to the actual available width when enlarged. Native-currency prices, missing-price messages and older-balance labels remain visible. Search, account, market, sorting and list-return state use their existing handlers.

### Home, performance and trend

- Increase the contrast of supporting text and make the active bottom navigation item easier to identify. The refresh icon is drawn as an inline CSS vector, while the existing accessible name and loading state continue to work.
- Give profit and loss subtotals separate quiet surfaces. Keep the selected period, total, partial-calculation status, calculation count and three leading contributors together in the compact period summary.
- Move the existing trend period selection directly below the title, including loading and retry states. The selected chart, horizontal period visibility and return position retain the existing continuity behavior.

### Judgment entry and readback

- Distinguish the saved reason and review condition from comparison assumptions and record timestamps through font size, contrast and spacing. Original saved text is preserved.
- Stack longer review labels above their values on small screens. Remove duplicate inset spacing around the active judgment form and its completed summary.
- When a real detail footer is showing its completed state, expose one full-width **저장 완료 · 목록으로** action. The inline completion control remains available in older components without that footer. Reopening a saved judgment restores the normal review and list-return actions.
- Keep the history-reload action secondary when a judgment form is open. Text input continues to suppress the sticky footer; non-text choices keep their existing actions available.

## Verification

The browser checks run the current HTML, rendering and production frontend handlers with isolated synthetic network responses. They do not write a judgment to a user's account.

- `tests/build67_ui_visual.mjs` includes checks for the rendered selected-option text fitting its field, complete and touchable market labels, holding fields staying within their rows, and names/quotes/amounts/status labels not covering one another. Its existing save-completion steps now use the real footer action.
- `tests/build211_decision_browser.mjs` additionally verifies a single visible completed footer action, a working close path, and restoration of the normal review/list actions on the next visit. Exact saved reason, condition, comparison payload and request identity remain covered.
- The daily-startup, trend-continuity, input-control and partial-P&L regression checks cover the shared UI changes and retained state.

### Completed local runs

- The full Chromium UI journey passed at 390, 402 and 430px, including the 390px 125% case, long names and billion-won values, chart interaction, form entry, saved decisions and list return. The compact period summary keeps all three leading contributors above the bottom navigation.
- The WebKit navigation run passed at the same three widths.
- A focused WebKit check also passed the rendered controls, touch targets, long names and billion-won amounts at all three widths and 125% CSS zoom. WebKit reports unscaled DOM rectangles under this artificial zoom, so the temporary hit-test probe converted them to actual pointer coordinates. Its container-query column choice differs from Chromium under CSS zoom; the acceptance criteria are complete text, usable controls and no overlapping fields.
- The actual-startup daily journey, trend loading/error/retry continuity and text/non-text input-control checks passed in both engines.
- Manual and comparison judgment save, a lost response, unavailable readback, an original-request retry and a fresh-page exact readback passed in Chromium and WebKit. A final WebKit run also checked the completed summary after its duplicate inset spacing was removed.
- Next-action, period-summary and provisional-P&L Node regressions passed. `git diff --check` passed.

The first layout pass exposed a fourth holding extending below the intended first-screen area. Amount columns now use the space their content needs, and the row spacing was adjusted. The regression checks the actual navigation boundary rather than a fixed 800px threshold.

## Remaining device verification

Chromium and WebKit mobile viewports provide repeatable browser checks. Physical iPhone home-screen relaunch, Face ID, the native keyboard and live account latency still require real-device verification. Financial-source completeness gaps retain their existing provisional presentation.
