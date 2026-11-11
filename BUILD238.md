# Build238 — Keep unchanged chart selection labels

## Starting state

Main and existing work/performance-detail-render-234 were d62308d3b4abd25b409afd5ad13198eccd541bed / Build237. Branch CI40832968364, main CI40833999713 and Pages40833998544 passed. Actual HTML/SW/version.json markers matched Build237. No running work or newer branch was found; continue the existing branch.

## Measurement and decision

The full app detail chart, after all data/history reads settle, rewrites both date and price text nodes on every selection input, even when the selected day has not changed. In five baseline sessions, 60 distinct days ×4 pointer samples per day replaced these labels480 times, without any requests or line-geometry rebuild. Those text replacements can dirty layout before the next geometry read.

Candidates: (1) avoid unchanged date/price text replacement — selected; (2) defer all chart input to animation frames — not selected, would change synchronous feedback/accessibility; (3) cache chart bounds across scroll/zoom — not selected, requires invalidation not justified by these measurements.

Only compare the next formatted date and price with current text before assigning textContent. Every selection still updates coordinates, visibility, selected index and aria-valuenow/aria-valuetext synchronously. Range changes still recompute geometry; same-day keyboard input still reveals a hidden crosshair. No data fetching, TTL, price formatting, calculations, saved judgments, preferences or financial storage changes. No new preload or retained cache.

## Controlled results

Five fresh Chromium140.0.7339.186 sessions per version,390x844 mobile/touch viewport,CPU4x,SW blocked,routing disables HTTP cache,no bandwidth throttling. Identical synthetic four holdings,365 daily prices/security,10 saved judgments and10 histories; locally fulfilled API responses50ms. Entire real startup/detail/navigation code runs. All requests are intercepted; no real credentials or production writes.

After idle detail, switch3months,zoom in,out,reset; then dispatch4 synthetic mouse-type pointermove samples in the same day per frame, over60 days. This uses the selection path also used by a captured one-finger move, but is not physical touch, native gesture dispatch, paint or INP. It intentionally exercises same-day high-frequency samples; actual device event rates and benefit can differ. Timing covers synchronous dispatch handling and intervals to animation callbacks, not server latency.

| Metric, median(range),n=5 | Build237 | Build238 |
|---|---:|---:|
|240-input synchronous handling sum,ms|951.1(656.7–1042.8)|513.7(467.5–564.2)|
|Largest four-input handler group,ms|32.3(16.6–50.6)|17.3(13.7–24.5)|
|Per-session median next-animation callback,ms|23.0(17.2–25.4)|16.7(16.6–16.8)|
|Date+price text replacements|480 each|120 each|
|Requests during chart controls/sweep|0 each|0 each|
|Observed long-task counts during sweep|0,0,0,1,1|0,0,0,0,0|

First3-month control callback28.8(26.5–29.8)→29.3(27.6–32.0)ms; zoom-in32.2(30.9–33.6)→30.7(26.7–33.4); zoom-out33.4(32.9–34.4)→34.2(32.9–34.5); reset32.7(32.1–33.7)→32.9(31.8–33.4). These overlap; no control-speed claim. The reliable structural result is360 fewer unnecessary text replacements, with nonoverlapping handling-sum ranges in this sequence. Do not claim this halves app loading, real iPhone latency or the historical five-second refresh. Initial page load was not rebenchmarked; this only changes selection label writes and adds no deferred first-use work. No new memory/timer/transfer-size claim. Raw observations:docs/PERFORMANCE_CHART238.samples.json.

## Validation and release

`node tests/detail_render_profile234.mjs --chart-input` reproduces5 sessions; UI_SOURCE accepts another index.html. `EXPECT_CHART_LABEL_REUSE=1 ... --verify --chart-input` checks both engines at390/402/430px×100/125%, selected indices, visible/accessibility label agreement, unchanged line geometry, hidden crosshair reappearance, no requests, overflow and close/browserBack. Chromium local six cases passed. Local Build225 Chromium six cases passed; its WebKit launch could not run because the local WebKit binary is absent. CI installs both engines and remains the release gate. Existing Build225 cross-focus/clear and Build233 pinch/fresh-data geometry checks cover complementary interactions. Required CI also retains full saved-judgment, currency, navigation, wealth and refresh regressions in Chromium/WebKit.

Release markers2026-10-29-chart-label-238 / my-portfolio-shell-2026102918-238. Final commit CI must pass, main SHA must still be the checked parent, then fast-forward and verify Pages plus live HTML/SW/version.json. Actual iPhone Face ID, native keyboard, physical touch and full PWA termination/relaunch remain untested.

Handoff: finish release gates first. The measured chart-label duplication is addressed; avoid blanket early-return in select(), since range changes and hidden-crosshair reveal still need updates. Period/zoom control times do not justify further optimization. Remaining independent investigation may profile home trend pointer selection at larger snapshot counts before changing its rendering, or measure long-session resource retention; do not infer a leak from code or alter financial definitions.
