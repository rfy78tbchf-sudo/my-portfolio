# Build236 complete refresh baseline — 2026-10-29 KST

Latest main decd65c9bfc048ea736d7265db41600b71befe9c remains Build236. Work branch work/performance-detail-render-234 started at407125ed8a20af62300be02d8261a2f5677cb3e6; its CI40815013827 succeeded. MainCI40797736354 and Pages40797735740 were already successful; live HTML/version.json2026-10-29-loading-state-236 and SWmy-portfolio-shell-2026102909-236 were rechecked. No duplicate branch or concurrent implementation. This commit only adds a measurement mode, regression and records. No app deployment.

## Scenario and actual measurement boundaries

`node tests/refresh_interaction_profile234.mjs --complete-refresh` runs five fresh Chromium sessions, two sequential refreshes each. Warm all four tabs first, return home, wait for idle. Four synthetic holdings,24positive prices/security,390x844 touch/mobile,CPU4x;50ms per fulfilled API request including sync actions, no bandwidth throttling. No manually held response in this mode. All API requests locally intercepted; SW blocked and routing disables browser HTTP cache. First refresh has background history/price sync due; second retains its valid TTL. Synthetic current asset changes by100000 per visit only to detect newly returned data; it is not real account reconciliation. Both clicks occur via the actual refresh button in the same browser task, verifying the disabled button prevents duplicate sync.

MutationObserver records the new amount appearing and aria-busy=false on the refresh button. All-idle additionally waits for live queues and backgroundSyncPromise to finish plus two rAF callbacks. These are DOM/automation timing boundaries, not paint, INP or real iPhone touch. The background interval follows foreground completion, so the ordinary button is available before all work finishes. No hidden delay/gate is subtracted. All-idle includes polling overhead.

Each condition has5samples for each refresh type. Different sessions cannot share app cache. No changed app code is deployed.

|Stage, ms median(min–max)|Build236|Settings-priority candidate|
|---|---:|---:|
|Background due: assetMs|173.3(167.6–183.4)|172.7(160.4–193.9)|
|Background due: foregroundMs|693.8(664.9–729.6)|642.5(637.6–691.6)|
|Background due: allIdleMs|1525.7(1458.6–1596.4)|1423.8(1407.1–1560.7)|
|Background TTL fresh: assetMs|176.4(161.3–184.5)|168.1(158.5–218.5)|
|Background TTL fresh: foregroundMs|673.0(644.4–706.7)|681.4(635.9–761.0)|
|Background TTL fresh: allIdleMs|693.9(667.8–723.0)|702.1(654.7–789.0)|

Every background-due sample makes37API calls with33731decoded JSON payload bytes; TTL-fresh samples18calls with16860bytes, unchanged by candidate. This is measured UTF-8 JSON body size supplied by the fixture, **not compressed transfer/wire bytes**; headers/auth/preflight/static assets are excluded. Each recorded response has a status, start timestamp and response-ready timestamp. Request timestamps use the Node clock relative to recording start; UI timings use the browser clock, so do not subtract them across clocks. Serialized request bodies/queries contain synthetic identifiers only. No heap/listener/timer accumulation measured.

The first cycle is one sync-current,17foreground reads,one history-month sync,one price sync and17reads after background data changes. The later cycle skips the two background syncs/reload through existing TTL reuse. The repeated17reads are separated by a real data-update boundary. They are not proven concurrent duplicate requests. Existing sequential broker sync protects source ordering; synthetic50ms acknowledgements do not model actual KB latency. These results do not establish that the historical approximately5-second operating refresh was fixed or reproduced.

Long tasks remain: baseline first-refresh observer reports3–8entries per session; second2–4. Candidate first2–6 and second2–4; ranges overlap and task durations vary. Raw samples preserve browser-reported durations, including timer-resolution rounding. No whole-flow zero-long-task claim.

## Candidates (maximum three)

1. Prioritize settings and reconciliation before home-review reads. Tested in a temporary UI_SOURCE copy: inside loadLiveDetails, create `initialReads=Promise.all([reconcile_live_cash_flows,get_app_settings])` before invoking loadHomeReviewData, then return initialReads.then with the original continuation. No API removed or calculation/cache definition changed. Five sessions each. Background-due all-idle1525.7→1423.8ms but ranges overlap; TTL-fresh693.9→702.1ms and asset timing does not consistently improve. Rejected as an uncertain improvement; retain source ordering. This candidate is not in index.html.
2. Remove post-background reload: rejected because refreshed history/prices can change the displayed calculations. Fixture responses are fast and deterministic, not evidence that fresh operating data is identical. Do not reuse stale results under a current timestamp.
3. Parallelize broker sync or increase the read queue: not selected. Local fixed latency cannot establish operating-service concurrency/rate-limit safety. No evidence here supports changing these constraints.

## Regression and handoff

--verify --complete-refresh runs six390/402/430px ×100/125% refreshes per engine. It asserts new amount displayed, enabled/idle button, amount fit, no application errors/unexpected writes, one sync-current on duplicate clicks, and complete JSON response accounting. Existing CI continues pending-response/search/focus, failure/retry, cache and saved-decision coverage; do not replace those with success-only timings. Local Chromium verification passed all six width/zoom cases; new CI covers Chromium/WebKit. Actual iPhone, native keyboard, Face ID and complete PWA termination remain untested.

Check final branch CI next. Keep Build236 live. Do not repeat the settings-priority candidate or claim synthetic response timings are operating speed. The request-stage baseline is now available; a next independent target is CPU work during foreground and post-background home renders (count/trace each render) rather than altering authoritative data reads. Check whether a repeated final render has a distinct loading-state transition before removing it; preserve loading/error/freshness indicators and standalone load behavior. If timing gains remain uncertain, retain the implementation.
