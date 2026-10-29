# Build239 bounded retained JavaScript heap observation

2026-10-30 KST. Existing performance branch cc6c418 CI40901474593 passed decision/mobile (Chromium and WebKit). Main11998325 and live HTML/SW/version markers remain Build239. No production source/data, annual-wealth branch, calculation, cache or deployment changes.

New opt-in --heap mode extends the existing repeated-detail diagnostic with Runtime.getHeapUsage immediately after existing forced GC. The installed Playwright CDP protocol describes usedSize as used JavaScript heap bytes, totalSize as allocated JavaScript heap, embedderHeapUsedSize as embedder GC heap, and backingStorageSize as array-buffer/external-string storage. Keep these separate; they are not whole-process RSS or iPhone memory. The browser heap includes application, automation/instrumentation and engine-retained state. No retainer graph, timer count or peak-memory measurement.

Run `DETAIL_REPEATS=10 node tests/detail_render_profile234.mjs --repeat --heap`, then independently `DETAIL_REPEATS=30 ...`. Each batch uses five fresh Chromium140.0.7339.186 sessions;390x844 mobile/touch,CPU4x,365synthetic prices,10saved judgments and10long histories,50ms locally intercepted API reads,SWblocked/no HTTP cache/no bandwidth throttle. Every visit opens the same security, waits for reads, expands one history body, scrolls, returns, collects GC and samples. No real broker data or operating DB writes. Heap mode only accepts the bounded Chromium repeat scenario; ordinary --verify behavior stays unchanged.

The ten-visit batch usedSize median increased from2,987,964 to3,357,456 bytes. This motivated the longer bounded batch below, rather than treating the initial increase as a leak. Do not compare batch timings as before/after performance: no application change exists.

|Visit in thirty-visit batch|Used JS heap bytes median(min–max),n=5|
|---|---:|
|1|2,987,972(2,986,508–3,007,408)|
|5|3,136,592(3,136,464–3,138,532)|
|10|3,353,452(3,353,132–3,357,792)|
|20|3,411,696(3,410,084–3,411,860)|
|30|3,439,692(3,438,580–3,441,528)|

All150 visits preserved2documents/3260DOM nodes/145listeners and8fresh reads each. No page errors, no repeated history requests within one entry. Per-session growth from visit20to30 was27,104–29,688bytes, versus approximately366KB through the initial ten-visit batch. Growth slows substantially but remains nonzero; these observations neither prove an app leak nor establish its absence. No blanket long-session or iPhone stability claim.

Candidates: (1) destroy retained last-detail DOM on close — no accumulating DOM/listeners, so not selected; (2) clear saved-history/chart data caches — heap ownership not attributed, so no safe freshness-preserving benefit established; (3) rewrite timer cleanup — no timer-count evidence; not selected. Avoid speculative cleanup or moving costs into the next entry. App stays Build239.

Validation: all200 entries across the two batches passed existing requests/DOM counter assertions plus finite positive CDP heap result checks; node syntax/diff checks passed. The optional diagnostic changes no runtime app behavior and does not require a new deployed version. Remote CI of this diagnostic commit remains to be checked next; its normal browser regressions remain enabled.

Next: check this commit's CI, then do not repeat the same bounded heap totals. To justify a memory fix, obtain application-owned retaining paths or a new reproducible long-session symptom; distinguish browser/automation retention before changing cleanup. Actual native iPhone memory, Face ID, keyboard and full PWA restart are untested. The separately blocked annual-history feature is not included.
