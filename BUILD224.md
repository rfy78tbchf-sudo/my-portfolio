# Build224 — 일봉 5일선 골든·데드크로스

Baseline: main 710a516 (Build223). User requested daily five-day MA crossings against other moving averages and has authorized implementation, verification and deployment. Original dirty worktrees are preserved; implementation uses a separate worktree/branch.

## Behavior

- Stock price chart shows the most recent observed 5/20, 5/60 or 5/120 SMA crossing, with its event date and the latest data date. Existing chart series supplies the daily closing prices; no additional request on normal detail entry, no financial writes or AI call.
- Expand `이평선별 상태` for each pair's current relative position and last crossing. Computational details remain collapsed, in accordance with the Build220 content priority.
- Golden = last unequal position below changes to above; dead = above changes to below. Equality alone does not fire, and touching then returning to the same side does not create a duplicate. Initial position is not an event. Tiny floating-point differences within 1e-12 of the value are treated as equality.
- Windows use full available history (same periods as the chart), independent of viewport, zoom, or toggles. Invalid/nonpositive closes, invalid dates, known currency mismatch, source changes and nonascending dates reset history. Insufficient pairs are not presented as `no crossing`.
- A historical event retains its actual date; it is not relabeled as today or as a new event on refresh. Details distinguish current position, missing history and no observed crossing. No automated trade or judgment-condition execution is added.
- The fallback price read now preserves source metadata for existing moving-average continuity checks. Normal detail data is still governed by the existing RPC contract. Existing daily-close ingestion guards reject pre-close rows; missing sessions and corporate-action adjustment completeness remain unverified and the disclosure states that limitation.

## Verification

- New arithmetic tests: all three pairs, golden/dead, unchanged side, flat/initial-above history, equality touch/reversal, invalid prices/date/currency/source, and an independent brute-force SMA oracle.
- Chromium: 390/402/430px, 100%/125% zoom; collapsed readable disclosure, all three simultaneous crosses, touch-size controls, chart-period/zoom/MA-toggle invariance, no overflow or browser errors. Korean 390px/125% capture inspected.
- Existing SMA/zoom/pinch suite and price-load fallback/retry suite pass locally.
- Local WebKit blocked by missing system libraries; CI runs the new browser suite in Chromium and WebKit before deployment. Require full branch CI, recheck main, promote, then verify main/Pages and live build/cache markers.

Build markers: `2026-10-28-ma-cross-224` / `2026102803-224`.
Physical iPhone validation remains separate from browser emulation.
