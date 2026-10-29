# Build236 editor phase attribution — 2026-10-29 KST

Verified main decd65c9bfc048ea736d7265db41600b71befe9c, work/performance-detail-render-234 at847f693b404b2d436298dce367c99ba9ca61806c, its CI40806794941 success, mainCI40797736354 and Pages40797735740 success. Actual HTML/version.json and SW still identify2026-10-29-loading-state-236 / my-portfolio-shell-2026102909-236. No competing active workflow appeared in the latest runs. Continue the existing branch; no product change or deployment.

## Measurements

Split the existing --late-history editor interval into revealSavedReview, openEditor, fillReason and fillReview. Each action uses the real visible UI, records CDP metric deltas and long-task start times, then two animation-frame callbacks. Five fresh Chromium sessions per condition,390x844 touch/mobile,CPU4x; warmed portfolio;365 positive prices,ten saved decisions/long AI histories; synthetic50ms reads and controlled history/decision gates; SW blocked and request interception disables browser HTTP cache. Every request remains synthetic/local; no live financial records or model calls.

| Step | Baseline callback ms median(range) | Baseline layout ms median(range) | Candidate callback ms median(range) | Candidate layout ms median(range) |
|---|---:|---:|---:|---:|
| Reveal saved review |179.6(174.5–254.7)|81.1(73.3–126.7)|190.6(175.7–204.1)|81.3(73.7–95.4)|
| Open editor |993.4(975.8–1010.8)|32.0(28.8–38.7)|992.7(960.0–1024.8)|29.8(25.7–40.7)|
| Fill reason |58.7(44.2–72.8)|3.6(3.6–4.6)|58.7(43.9–62.1)|4.4(3.1–7.0)|
| Fill review condition |60.9(59.3–76.7)|3.9(3.5–6.1)|62.0(59.8–76.8)|3.7(2.5–5.4)|

The approximately1-second automated editor callback includes Playwright scrolling/stability checks after smooth navigation. It is **not evidence of a1-second JavaScript handler, real iPhone input latency, INP or server delay**. CDP layout cost is measured separately. Baseline reveal has2layouts and one88–159ms long task per sample. Editor opening has3layouts and a53–67ms long task in four of five samples. Neither text-fill step has a50ms long task in these samples. This is a bounded interval, not a zero-long-task claim for all typing or use. Durations in the raw CDP JSON are seconds; the table converts layout to milliseconds. Task counts are assigned by task start. Metrics include automation and are not additive components of callback wall time.

## Candidate decisions

1. Avoid layout for closed optional details: tested by inserting `.detail-sheet details:not([open]) > :not(summary){display:none}` before the first `</style>` in a temporary copy of index.html, passed via UI_SOURCE. Baseline and candidate each had five fresh sessions with identical fixtures/conditions. Reveal layout81.1→81.3ms and callback179.6→190.6ms provide no improvement evidence; ranges overlap throughout. Rejected; rule is not in the app. Reproduce with the same served-source transformation and `node tests/detail_render_profile234.mjs --late-history`.
2. Remove optional-review expansion or editor relocation: not selected. They reveal requested information and keep the active form ahead of a long saved review. This measurement does not establish redundant repeated layout in one event. Do not change the product flow just to shorten the test.
3. Replace smooth navigation to reduce the automation wait: not selected. A locator wait is not proof of device input blocking. Do not claim a speedup from changing the user-visible navigation behavior without actual input/frame evidence.

Both conditions retain8detail requests, chart DOM/period/point and draft/focus/selection; no additional request-sharing fix is indicated. No transfer-byte, heap, listener/timer measurement. No performance improvement claimed; no calculation, storage or freshness behavior changed.

## Regression and handoff

The existing --verify --late-history CI mode automatically exercises the added step instrumentation in Chromium/WebKit at390/402/430px ×100/125%; it checks draft, amount fit, chart state and return focus. Local Chromium verification passed all six width/zoom cases. Check final branch CI; WebKit runs in CI because local OS dependencies are absent. Actual iPhone/Face ID/native keyboard/PWA termination are not tested.

This closes the specific closed-details CSS hypothesis. Do not repeat this editor microbenchmark without new attribution evidence. Next priority is a current complete-refresh baseline: measure click-to-current-assets and click-to-refresh-idle separately, without manually gated responses, using fixed synthetic read/sync latency and request/byte accounting where supported; retain refresh-failure, duplicate-click and freshness assertions. Synthetic endpoint latency must never be presented as operating KB/server speed or confirmation of the old approximately5-second observation. Check this diagnostic commit CI first; keep Build236 deployed unless a later measured change passes the release gates.
