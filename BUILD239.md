# Build239 — Avoid unchanged home chart tooltip replacements

Starting state: main3527c22122a76b44ab5c715a8a418e3cc7f184e7 / Build238; existing work branchdc588fa1fe89bbffe78d97f036ce07207629a4a4 with CI40857700892 success. MainCI40846930914 and Pages40846930282 succeeded; actual HTML/SW/version.json matched Build238. Continue this branch, including its corrected chart diagnostic; no duplicate work or production data access.

## Measurement and candidates

Five fresh Chromium140.0.7339.186 sessions per condition,390x844 mobile/touch,CPU4x,50ms locally fulfilled API reads,no bandwidth throttle,SWblocked/routing disables HTTP cache. Full application startup, warm tab round trips, then home trend. Synthetic90 daily asset observations; separate365-observation scaling baseline. Sixty frames ×four same-point synthetic pointermove samples; sweep60 selected indices. Time synchronous dispatch and next-rAF callback separately; assert the synthetic date and amount on every group. No real finger input, paint/INP, actual server or iPhone speed claim. Zero requests during every chart sequence. No heap/longtask/wire-byte measurements.

| Metric median(range),n=5 | Build238,90 points | Scale-hoisting candidate,90 | Tooltip candidate,90 | Build238,365 points |
|---|---:|---:|---:|---:|
|240-input handler sum,ms|628.0(593.3–855.2)|587.9(552.0–772.8)|453.2(320.1–533.0)|645.1(560.0–1047.2)|
|Largest four-input group,ms|24.6(20.9–29.0)|22.0(17.6–26.2)|20.0(14.3–23.5)|22.5(17.1–34.8)|
|Per-session median next callback,ms|16.7(16.6–20.2)|16.8(16.6–19.1)|16.7(16.6–16.7)|17.1(16.6–25.5)|
|Tooltip HTML replacements|240 each|240 each|60 each|240 each|

Candidates: (1) hoist min/max calculation from each input — rejected, overlapping variation/no callback improvement; (2) avoid identical tooltip HTML replacement — selected,180 fewer replacements with nonoverlapping handling-sum ranges; (3) downsample larger history — not selected,90→365 scaling does not establish a material data-size bottleneck and would discard display detail.

Only compare the desired tooltip HTML to current innerHTML before assigning. Crosshair coordinates, guide/dot position, tooltip/clear visibility and pointer cancel are still updated every event. Keep all scale calculations, observation dates/amounts, request behavior and financial definitions. No bounds cache, new retained data, deferred first interaction or preload. First-site loading was not rebenchmarked; this change only executes in existing chart selection. The repeated-input saving does not establish a faster total app load or resolve the historical five-second refresh.

## Regression and handoff

`HOME_POINTS=90 node tests/refresh_interaction_profile234.mjs --home-chart` reproduces timing; UI_SOURCE selects another HTML. `HOME_POINTS=365 ... --verify --home-chart` exercises both engines at390/402/430px×100/125%, exact synthetic selection amounts/dates, clear, touch-type pointerdown reappearance, pointercancel, line identity and zero extra requests. Existing workflows retain tab/detail/back/scroll, currencies, judgment persistence, chart cross focus, wealth and refresh regressions. Raw four datasets:docs/PERFORMANCE_HOME239.samples.json. Previously recorded Build238 detail-chart samples are not mixed into these results.

Final branch CI must pass before freshly checking main SHA and fast-forwarding. Then verify Pages and actual HTML/SW/version.json markers2026-10-29-home-tooltip-239 / my-portfolio-shell-2026102920-239 before reporting deployment. Physical iPhone touch, native keyboard, Face ID and full PWA restart remain untested.

Handoff: finish release gates first. Do not apply the rejected scale hoist or data downsampling. Home tooltip and detail label repetition are addressed; avoid further micro-optimizations without a new controlled bottleneck. A future independent target is initial download/script execution under explicit bandwidth/CPU conditions, preserving offline caching and first-interaction behavior.
