# Build234 cold/warm startup follow-up — 2026-10-29 KST

Continued work/performance-detail-render-234 at5d43123; CI40771317344 succeeded, including both engines and the new six-case row geometry test. Latest main716448a and its CI40690490893/Pages40690485277 remain successful. Live HTML/SW/version.json were fetched again and still identify2026-10-28-detail-reads-234 / my-portfolio-shell-2026102813-234. No parallel app implementation found. No product change or new deployment in this run.

## Measurement

Extended the existing real-HTTP/service-worker fixture with optional --profile-startup, not a second fixture. Five fresh Chromium sessions per variant, each cold visit then warm reload with persistent same-context caches/storage.390x844 mobile/touch, CPU4x, Playwright1.55.1 Chromium1193, four synthetic holdings, mocked50ms API responses, uncompressed local HTTP without bandwidth throttling. All account data synthetic. This is not a production-server, compressed-wire, iPhone or PWA full restart measurement.

Asset time: MutationObserver finds the expected synthetic home amount then records performance.now after two animation callbacks. Not presented paint or INP. Idle-observed time additionally waits for API idleness, update check and service-worker readiness; not time to first usable assets. First portfolio interaction is programmatic, **after that wait**, not earliest possible user input. Callback time uses two rAF callbacks; idle includes shared enrichment. Counts/bytes are captured before that interaction. CDP ScriptDuration delta is script execution, not total parse/compile/layout/render CPU. Long tasks cover the startup observation interval, not just pre-asset work. Unsupported WebKit metrics are null.

Baseline median(min–max), ms:

| Metric | Cold | Warm |
|---|---:|---:|
| Asset callback |503.8(430.0–596.6)|268.5(259.5–349.5)|
| Idle observed incl. SW readiness |1132.7(1119.6–1321.1)|923.4(891.8–1000.4)|
| CDP script execution |24.3(21.2–32.2)|15.8(15.0–31.4)|
| First portfolio callback |128.4(115.9–173.0)|92.9(73.1–128.7)|
| First portfolio idle |880.7(819.1–920.9)|780.6(769.0–850.4)|
| Long-task count |6(5–7)|4(3–6)|

Startup API calls19 cold/17 warm, first portfolio31 calls in all ten observations. Server body bytes cold1558293–1560833; warm731086. Cold response count51–52, warm23; these include preflight/shell responses, not only data reads. Variation2540 bytes is a service-worker script response. Update probe is40bytes/one request throughout. Bodies include test-hook bytes and are NOT raw production payload sizes. Warm reload is network-first HTML as designed, not zero-download offline navigation.

## Candidates, experiment, decision

1. SW installation/precache could compete with first assets (hypothesis). Changed ONLY the served test source to wrap the existing register call in setTimeout(...,1000), then ran five more cold/warm pairs sequentially under the same conditions. No simultaneous local browser benchmarks. Asset median500.9(479.2–568.9) cold /271.3(250.4–286.6) warm. First portfolio callback131.1(122.1–148.3) cold /110.9(88.0–133.9) warm; corresponding idle839.4(810.9–864.9) /792.5(786.1–805.3). Cold SW-ready observation delayed to1393.2(1379.7–1445.5). No clear first-asset gain; rejected. This wait change also alters time before the interaction, so do not interpret modest enrichment differences as an optimization. No production timer added.
2. JSZip precache: the cold fixture observes the97630-byte vendor file even though runtime loading is on demand. Removing it would change first offline import availability. No execution-cost evidence for that unopened library (download is not execution). Keep current behavior; do not call deletion a proven responsiveness improvement.
3. HTML/shell payload: large HTML plus initial index precache remains visible in response list. Simply dropping index would break cached navigation fallback. Splitting code or changing cache freshness is not justified from byte totals alone; no speculative cache rewrite.

No before/after gain claimed. Cold/warm differences are different cache states, not implemented improvements. No layout or financial definition changes. Earlier rejected row-layout/history/swing scheduling candidates stay closed.

## Validation and handoff

Instrumented20 navigation observations passed expected amount/row and single-update assertions. Local Chromium --verify --profile-startup also checks new-version notice without reload/draft loss, missing/malformed manifest HTML fallback, unavailable update preservation and cached-index fallback for failed navigation. CI's existing Chromium/WebKit SW step now includes the profile flag; check final commit CI next run. Local WebKit needs CI OS dependencies. No real iPhone/native keyboard/Face ID testing, no heap/timer accumulation conclusion, no operating DB writes.

Next: attribute the observed startup long tasks to actual layout/parse/render phases before choosing a change; current ScriptDuration does not cover them and must not be treated as total main-thread cost. Capture a bounded Chromium trace in this same fixture, separate pre-asset from post-asset work and test earliest safe first input if a new scheduling candidate emerges. Avoid repeatedly running these unchanged aggregate baselines. Keep Build234/main unchanged unless a reproducible, regression-safe gain is demonstrated. Routine no-change results need no notification.
