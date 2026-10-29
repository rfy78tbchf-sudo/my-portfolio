# Build239 paced startup trace attribution

Starting state: main11998325e4b7cdaaf8dd72c393d00d2c48e43e7d; existing workeb5abfca9f881c6e2114813dc0a3cc8a7514f478. Its Chromium/WebKit CI40881844828 passed. MainCI40865599440 and Pages40865598206 passed; actual index/SW/version.json matched Build239. No duplicate branch, product change or deployment.

## Method and evidence

Run the existing diagnostic unchanged: `PACED_GZIP=1 node tests/build232_update_latency.mjs --paced-startup --trace-startup`. Five fresh Chromium140.0.7339.186 sessions, each cold navigation then warm reload;390x844 mobile/touch,CPU4x,four synthetic holdings,24 prices/security,eight asset observations,API50ms. Actual local HTTP/SW cache, shared200KiB/s response-body pacing,80ms response-header delay,gzip. This is software pacing, not production bandwidth/RTT or real iPhone/server timing. No production financial data or writes.

Tracing devtools.timeline/blink.user_timing/toplevel and served-source render marks adds overhead. Do not compare these timings against the earlier untraced batch as a product regression or improvement. The asset boundary follows matching synthetic amount plus two rAF callbacks; it is not a presented-paint/INP measurement, and warm cached preview does not certify fresh account data.

For each event name and each side of the asset boundary, clip intervals at the boundary and take their interval union. This avoids double counting within that name. Different event names remain nested/overlapping: NEVER add ParseHTML, EvaluateScript, FunctionCall, Layout or style totals into a CPU budget. CDP ScriptDuration has different semantics and is recorded separately through startup idle/SW-ready.

| Metric median(range),n=5 each | Cold | Warm |
|---|---:|---:|
|Asset callback,ms|1484.1(1463.6–1495.8)|1179.3(1150.3–1197.2)|
|Startup idle observed,ms|3512.5(3431.8–3551.8)|2959.2(2927.7–3032.7)|
|Pre-asset ParseHTML interval union,ms|171.5(156.8–174.8)|124.4(107.3–151.2)|
|Pre-asset EvaluateScript interval union,ms|62.2(52.2–71.5)|17.9(15.2–30.8)|
|Pre-asset Layout interval union,ms|231.3(188.2–311.4)|174.7(164.3–196.6)|
|Post-asset Layout interval union,ms|218.2(190.4–310.1)|190.4(186.6–236.9)|
|CDP ScriptDuration delta,ms|50.3(45.6–57.2)|39.0(35.0–45.9)|
|Long tasks observed|8(7–8)|5(4–6)|
|Home render starts|6 each|6 each|
|Startup API reads|19 each|17 each|
|First portfolio two-rAF callback,ms|156.0(122.7–172.5)|120.3(109.5–142.5)|
|First portfolio all-read-idle,ms|2870.5(2852.0–2892.8)|2831.1(2816.7–2857.3)|
|First portfolio reads|31 each|31 each|

The inline script EvaluateScript duration sum is61.4(51.1–70.0)ms cold and17.9(15.2–30.8)ms warm. Each external classic script contributes less than2ms in every sample. Module execution is not represented by an identifiable EvaluateScript event here; absence is not zero cost. CompileScript is absent under this capture/filter, so compile cost cannot be separated. ParseHTML includes nested work and dynamic markup parsing; its total is not isolated initial HTML parsing.

Full samples are in PERFORMANCE_STARTUP_TRACE239.samples.json, retaining original event records and all long-task/response data. The harness's legacy conditions string says 'no compression'; the explicit pacing.gzip=true metadata is authoritative for this run. This documentation corrects that label without changing the measured harness. Response bodies are not TLS/wire transfer bytes.

## Candidate decisions and continuation

1. Split/defer application JavaScript: not selected. The trace bounds observed inline evaluation but does not isolate parse/compile or prove safe lazy-module boundaries. Moving code to first interaction may merely move cost and add requests; no controlled candidate improvement exists.
2. Defer external classic scripts: not selected. Their observed evaluation is under2ms each; access/authentication/UI behavior and transfer scheduling must remain intact. This evidence does not justify a new preload/defer scheme.
3. Batch further home renders: not selected. Layout dominates the captured categories, but the six stages include early assets, core data, review/performance and completion state. Temporal proximity alone does not establish equal DOM/data/error/loading semantics. Existing Build235/237 duplicate-removal results remain valid; do not remove another stage from aggregate timing alone.

All ten sessions completed with expected synthetic assets, four portfolio rows, update request count, zero page errors and zero forbidden writes. Product/test source is unchanged, and its final CI40881844828 already passed Chromium/WebKit regressions. No new code needs screen-width/zoom regression or deployment. No memory/timer or physical iPhone/Face ID/native keyboard/full-PWA-restart claim.

Handoff: retain Build239. Avoid repeating this aggregate trace or previously rejected scheduling/containment candidates. A further render change needs per-caller data-state/DOM comparison and staged failure/early-input ownership assertions before a matched A/B experiment; a split needs actual parse/compile attribution and first-interaction/offline tests. If neither has concrete new evidence, leave production unchanged rather than generating another diagnostic-only cycle. This record completes the prior pending CI continuation and the requested targeted initial script attribution.


## 2026-10-30 continuation: complete refresh check

Previous final branch 83ca2d2 CI40895499507 passed both Chromium/WebKit suites. Main11998325 CI40865599440 and Pages40865598206 remain successful; live version.json still reports2026-10-29-home-tooltip-239. The separate annual-wealth feature branch is awaiting publication approval and was not included in this performance run.

Ran `node tests/refresh_interaction_profile234.mjs --complete-refresh --profile-render` against unchanged Build239: five fresh Chromium sessions, two consecutive refreshes per session,390x844/CPU4x/four synthetic holdings/24prices each,50ms per intercepted API call, no bandwidth throttle, warmed app tabs, blocked SW/routed cache. Browser build remains140.0.7339.186. DOM observers mark changed assets and button aria-busy=false; all-idle also waits for background completion/queues and two animation callbacks. Served-only phase instrumentation and DOM serialization add overhead; these results are NOT a controlled comparison with older batches or evidence of a production slowdown/speedup.

|Metric median(min–max),n=5 each|Background due|TTL fresh|
|---|---:|---:|
|Asset DOM,ms|195.6(190.3–237.3)|183.0(174.4–190.3)|
|Button ready,ms|763.0(738.6–921.1)|746.3(690.8–784.4)|
|All-idle callback,ms|1609.2(1548.6–1709.7)|774.6(704.2–822.2)|
|API calls|37.0(37.0–37.0)|18.0(18.0–18.0)|
|Decoded fixture JSON bytes|33731.0(33731.0–33731.0)|16860.0(16860.0–16860.0)|

All five sessions retain10background-due/5TTL-fresh home renders,37/18API calls and exactly one foreground sync after duplicate button clicks. Final changed amount is displayed, button enabled, no page errors or unexpected writes. Long-task counts are5–8background-due and3–4TTL-fresh; no zero-long-task claim. Decoded fixture sizes exclude headers/compression/TLS and are not wire bytes. No actual KB latency, iPhone paint/INP, heap or timer retention measurement.

One same-HTML stage occurs in each load, including post-background load, but this deterministic equality is not evidence of identical data/error/listener state across all responses. No new safe render-elision candidate was established; do not remove it based on equality alone. Repeated request identities are separated by the background data update, and the second refresh correctly uses TTL. No new evidence justifies repeating rejected queue/ordering/reload-removal candidates. Product, SQL and test code unchanged; no deployment or additional unchanged-code regression cycle needed after the successful final-code CI. Raw observations: PERFORMANCE_REFRESH239_CHECK.samples.json.

Next: avoid another identical aggregate startup/refresh benchmark. A future product change needs a new reproducible interaction or per-caller state-transition bottleneck plus matched A/B evidence. Keep the annual-history request separate; do not use this performance authorization to publish that blocked feature. Physical iPhone keyboard/Face ID/PWA restart remain untested.
