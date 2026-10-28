# Build225 — inspect MA crossings directly on the chart

User request: tap when needed to see the golden/dead crossing on the chart. Baseline main cbfa9e887af3023a24cb1e39f254bcbde8291fce (Build224).

- Recent event chips and each pair in the collapsed details are accessible buttons labelled 차트에서 보기.
- A tap jumps to a 40-observation window around the recorded event, shows the 5-day and target MA, and marks each MA value on that event date. The marker denotes the confirmed daily observation, not an invented intraday intersection or the closing price.
- Only while inspecting, a compact chart status shows pair, direction, date and 표시 해제. No event overlay appears initially. Calculations and disclosure remain unchanged.
- Dismiss or tap the same pair again restores the original viewport, period, selected close and MA preferences. Switching pairs retains the original restore state. Inspection does not persist temporary settings. Deliberate period/zoom/pan/MA or chart-touch navigation exits inspection without overriding that navigation.
- No API/data/schema changes, financial writes, external requests or AI calls.

## Validation

- Arithmetic and independent SMA oracle (Build224) passed.
- Chromium 390/402/430 at 100%/125%: golden/dead, distinct pair dates, event outside the original viewport, plotted marker coordinates, keyboard/touch activation, switch/restore, no settings persistence, readable touch targets and no horizontal overflow passed. Korean 390px/125% screenshot inspected.
- Existing chart pinch/pan/MA regression passed, as did preferences and price-retry recovery. Build90 browser harness now includes the new bind dependency.
- Saved-decision/navigation/performance regression: 127 passed.
- Local WebKit cannot launch because host libraries are missing. Remote CI runs both Chromium and WebKit, including the new suite, before promotion.

Build markers: 2026-10-28-cross-focus-225 / 2026102804-225.
Actual iPhone keyboard, Face ID and PWA lifecycle tests remain separate.
