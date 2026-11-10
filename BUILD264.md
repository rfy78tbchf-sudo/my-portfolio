# Build264 — collect history before the final account read

2026-11-10 KST. Baseline main71386cb45109e2232d2f7a298c2a7fb7d5c2a79d (Build261); work15bbdd62fc3b28e2ebac325494d544680d203a7f. Fresh CI42725117578/42722843360 and Pages42725117323 success; live version HTTP200 confirmed261. No competing work-head change. Continued BUILD263's overlap hypothesis. No production broker/database requests or financial mutations.

## Reproduced correctness gate

Actual `loadLive` and `completeBackgroundSync` extracted into isolated VM, synthetic10ms edge replies, manually held in-flight account read. History changes from revision1 to2 after the account read starts. Before: background completion calls loadLive, coalesces into the older read and reports completion with displayed revision1. Reproduced3/3. This is a data freshness error, not evidence of a faster correct result.

After collection succeeds, capture any pending account read, await its settlement (including failure), recheck session ownership, then start/join a read that begins after collection. Preserve original no-pending path, history TTL/forced collection, partial-source success, sequential broker work, all calculation formulas and financial states. After: displayed revision2 in3/3. Overlap account reads1→2: the extra read is necessary to fetch the newly collected data; it is not a performance gain. No overlap still performs1 read. No stale result is promoted to current by this patch. No UI layout change.

Raw `performance/background-overlap264-{before,after}.json`, reproducible with `UI_SOURCE` and `EXPECT_FIXED=1 node experiments/background-overlap264.mjs`. About41–42ms is harness-controlled completion time, NOT request→correct browser paint, production server latency, or before/after speed improvement. Baseline never displays the new revision in this fixture.

## Validation

`tests/build264_collected_history.mjs`: overlapping read, failed pending read recovery, owner change while waiting, all collection calls failing, idle request count. Existing build141/142/197/242 and update72 pass. The two extracted-function fixtures142/242 now initialize the existing liveLoadPromise variable; no weakened assertions. New gate added to required CI.

Normal-refresh browser comparison: Chromium140/Playwright1.55.1,390×844,touch,4 synthetic holdings,50ms mocked API replies,unthrottledCPU,SWblocked,warm authenticated app. Three samples per period per source. Before then after serial runs; variation is not a speed claim. All52 requests/sample preserved, correct subtotal/unknown rendering assertions pass. This normal-refresh test excludes broker synchronization; overlap correctness is tested separately above.

|Period|Before correct paint median(range),ms|After median(range),ms|
|---|---|---|
|1W|394.3(389.1–396.7)|405.7(378.4–406.4)|
|1M|406.4(403.4–416.4)|401.6(400.7–419.0)|
|3M|388.7(381.1–391.4)|395.6(393.3–404.2)|
|ALL|394.5(385.2–401.2)|394.0(391.4–398.5)|

Raw `performance/refresh264-{before,after}.json`. No material normal-path request change or consistent speed effect; no p95/memory improvement claim. Required exact-SHA Chromium/WebKit/mobile widths390/402/430 and125% CI must pass before main promotion. Actual iPhone FaceID/native keyboard/PWA termination not tested.

## Release and next work

Candidate marker2026-11-10-collected-history-refresh-264,SWmy-portfolio-shell-2026111012-264. At this commit, release is pending exact-SHA CI and fresh main lease; do not call deployed until Pages and live markers are verified. Final handoff will record outcome.

This run chose accuracy over suppressing a required post-collection read. Do not optimize this new read away by reusing pre-collection results. Next measure the full intercepted foreground/background orchestration through the browser, including a second manual refresh while history is pending and a single failed historical month. Separate fresh-balance paint from post-settlement-result paint. The prior263 resume/swing and262 total-first experiments remain settled; do not repeat them. Operating intermittent P&L latency and physical-device lifecycle remain open.
