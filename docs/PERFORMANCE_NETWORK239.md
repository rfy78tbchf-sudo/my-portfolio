# Build239 startup under controlled aggregate HTTP body pacing

Main/work11998325e4b7cdaaf8dd72c393d00d2c48e43e7d / Build239. Final branchCI40864416331, mainCI40865599440 and Pages40865598206 all passed. Actual index/SW/version.json matched Build239. Existing branch retained. No app change or deployment in this diagnostic.

## Controlled experiment

Add optional --paced-startup to the real local HTTP/service-worker startup harness. Unlike page-target CDP network throttling, server pacing covers ALL local HTTP responses including service-worker independent requests. A shared round-robin queue emits at most4096 body bytes per20ms (nominal aggregate200KiB/s), after80ms before headers for each response. API fixtures retain50ms processing delay. Headers, chunk framing and TLS are NOT modeled. This is deterministic software body pacing, not a physical network/RTT simulation; event-loop scheduling may reduce effective throughput. No operating backend data or latency measured.

Five fresh Chromium140.0.7339.186 contexts per condition, each cold navigation then warm reload in the same context,390x844 mobile,CPU4x,actual service-worker install/cache/update paths. Synthetic four holdings,24 prices/security,eight asset observations. Cold means a fresh browser context; warm means populated SW/browser caches after first navigation and portfolio/home round trip. All data remain synthetic and local. Compare identical app/fixtures/pacing with local compression off versus PACED_GZIP=1; gzip covers text/JSON/JS/SVG responses. Server body counters record decoded and encoded sizes separately. No actual compressed wire-byte claim.

An independent read-only production HTML request with Accept-Encoding:gzip returned Content-Encoding:gzip and174435 encoded bytes. This is only one static deployment response, not a startup benchmark. Pages already compresses HTML: local gzip savings cannot be claimed as a newly implemented production improvement. Local injected test HTML/headers/backend responses differ from production.

| Metric median(range),n=5 | Plain cold | Gzip cold | Plain warm | Gzip warm |
|---|---:|---:|---:|---:|
|Asset callback,ms|3813.6(3781.0–3835.5)|1448.0(1411.2–1523.8)|3465.8(3436.8–3551.7)|1105.5(1084.4–1149.0)|
|CDP script counter delta,ms|63.9(48.6–75.0)|44.7(36.8–52.8)|40.3(28.3–65.0)|33.4(23.6–35.2)|
|First portfolio callback,ms|154.2(107.2–302.9)|134.0(109.7–173.2)|100.4(74.2–183.3)|90.3(80.0–142.6)|
|First portfolio all-read-idle,ms|2990.2(2944.6–2997.4)|2842.5(2825.8–2918.6)|2944.6(2911.4–2986.8)|2825.8(2810.4–2882.0)|
|First portfolio requests|31|31|31|31|
|Startup encoded response-body bytes|1559697–1559699|424597 each|731820 each|197265 each|
|Startup HTTP responses including OPTIONS/cache fills|51–52|51 each|39 each|39 each|

Asset and portfolio metrics end at animation callbacks, not presented paint or INP. Script counter covers navigation through startup idle/update/SW-ready observation, not just asset-critical execution, and is not compilation-cost attribution. The difference between first portfolio callback and all-read-idle is visible in every condition; do not label that entire wait as blank-screen latency. Response counters include cache population and small OPTIONS variations. Raw long tasks are retained (gzip cold7–8,warm3–4), not zero-long-task evidence. No memory/timer measurement or actual iPhone timing.

## Candidate decisions and next action

1. Add HTML compression — not selected: production already serves gzip. No app-code change justified by this local toggle.
2. Make warm navigation cache-first or remove shell precaching — not selected: would change freshness/offline guarantees without equivalent correctness evidence. Warm network-first fetch is intentional; do not disguise stale data/version as current.
3. Increase read concurrency or remove portfolio enrichment — not selected:31 reads extend all-idle but first content arrives much earlier; artificial local latency does not establish operating server capacity or which reads block necessary information. Next instrument necessary-information readiness/request stages under the same controlled conditions before choosing concurrency or lazy-read changes.

Reproduce: `node tests/build232_update_latency.mjs --paced-startup` and `PACED_GZIP=1 node tests/build232_update_latency.mjs --paced-startup`. Existing default modes do not start the pacing timer and keep uncompressed original response behavior. Both five-pair runs passed existing asset/row/update-request assertions. Local standard Chromium --verify checks cached navigation, new-version detection, fallback, unavailable/malformed update and draft preservation. Required Chromium/WebKit CI for the prior app is successful; check the new diagnostic commit CI on continuation. No main promotion is intended for this measurement-only record.

Handoff: preserve Build239. Do not repeat chart micro-optimizations or claim this measurement changed production speed. Investigate first portfolio enrichment stages only with visible-readiness/freshness assertions; alternatively collect targeted initial parse/execute traces before proposing code splitting. Native iPhone Face ID/keyboard/PWA termination remain untested.
