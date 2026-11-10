# Build265 — start history collection after broker balances, alongside display reads

2026-11-10 KST. Baseline main1fa6d4466a3f4cd1cdda37b0435e832f0e5c3138(Build264), work9c2520698b84fbe38b52b5af4f7074e8b2afd506. Fresh Pages42747247680 and required CI42745371344 successful; main duplicate CI42747248781 was initially running and subsequently succeeded. Live version.json HTTP200 matched264. No competing work-head changes. Existing automation retained without duplicate schedule. No production data/ledger/broker mutations.

## Measurement and chosen hypothesis

Followed264's next task through the actual refresh button. Existing flow waited for the entire foreground load, including nonessential follow-up reads, before starting history collection. In the synthetic trace first period paint occurs around0.48s, but history starts around1.2s. Candidates: remove post-collection read(rejected by264 freshness evidence), remove forced history retry(rejected because a later manual request needs later data), or begin history after sync-current succeeds/settles while frontend reads proceed(selected).

Move the existing fire-and-forget completeBackgroundSync(true,requestedAt) invocation from foreground-load completion to immediately after sync-current, before loadLive. Broker history/price calls remain sequential. Preserve original error capture, forced history start timestamps, TTL, auth guard, coalescing, and Build264's post-collection read barrier. No new cache, calculation change, UI or collection source. Background data writes may overlap display reads; the existing post-collection fresh-read guarantee is retained to publish the final state.

## Fixtures and baseline

`experiments/manual-refresh265.mjs` derives from refresh_critical_path253. All browser traffic locally intercepted; no real broker invocation. Chromium140/Playwright1.55.1,390×844,touch,4 synthetic holdings,50ms responses,unthrottled CPU,SW blocked,warm authenticated app. Financial RPCs are synthetic responses, not actual SQL or production timings. Each successful synthetic history collection increments its data revision; every final displayed total must match the latest successful revision. Record every correctly displayed revision after two animation frames, RPC request/queue/response stages, render duration, edge phases and request counts. Previous revision0 is excluded from fresh-result timings.

Initial48 baseline samples:1W/1M/3M/ALL ×3 repeats×normal/slow/history-failure/second-click. Slow adds1000ms to first monthly collection; second-click occurs while that collection is pending and the foreground button is reenabled. Failure explicitly supplies a two-month synthetic history window(current month then previous month), delays/fails the second month, and verifies the successful month remains visible. Normal production Nov10 window has only one month; the initial fixture incorrectly assumed two and was corrected before retaining the48-sample run. Raw performance/manual-refresh265.json. This initial run times preparation-to-paint; paired comparison below adds actual click timestamp capture.

## Matched repeated comparison

`experiments/refresh-overlap265.mjs` generates an isolated candidate. `experiments/refresh-pairs265.py` runs3 alternating pairs for1M and all4 scenarios,24 samples total; same fixtures/browser/viewport/CPU/transport/cache. Actual click capture aligns paint times. One third pair overlapped a separate functional run and was discarded/replaced serially; only uncontended comparison samples retained. Reproduce with BASELINE_UI/CANDIDATE_UI paths (export baseline git1fa6d44:index.html, generate candidate with UI_SOURCE set to that baseline). No tail-percentile claim from3 samples per cell.

|Scenario|Latest successfully collected revision: click→paint before median(range),ms|After median(range),ms|All requests before→after|
|---|---|---|---|
|Normal|1646.4(1628.6–1712.5)|445.9(429.5–446.8)|107→107|
|History delayed1000ms|2646.0(2626.8–2685.8)|1546.5(1546.3–1562.9)|107→107|
|Second manual refresh while history pending|3880.2(3829.5–3896.1)|2725.5(2662.5–2796.6)|213→161|

First fresh result medians remain446–448ms before and446–447ms after across slow/second/failure scenarios; no first-result regression detected. Normal first result already includes collected data after change. One-month failure fixture successfully displays collected revision in all runs; its earlier successful-revision paint does NOT mean the failed month succeeded or the failure was known earlier. Raw performance/refresh-pairs265.json retains failure events. No reduction of the forced retry or suppression of partial-source failures. Both normal runs retain2 stock-total requests; second-click case4→3 because collection timing permits more work to be shared while latest revision still displays.

Candidate regression for1W/3M/ALL ×4 scenarios,one each: all final revisions correct, raw performance/manual-refresh265-other-periods.json. These are functional checks, not sufficient samples to claim per-period speed distributions. Local tests265,264,242,142,197,72 pass; new265 checks sync-current ordering, history starting before ancillary completion, duplicate manual request sharing, post-collection freshness and foreground broker failure. Existing264 owner/failed-pending-read guards retained. Required CI adds the full button-flow fixture in Chromium and WebKit, plus existing mobile390/402/430 and125%,financial/period-switch/first-interaction regressions. No memory improvement or actual iPhone lifecycle claim.

## Release gate / continuation

Candidate marker2026-11-10-overlap-history-265, SWmy-portfolio-shell-2026111013-265. Exact final-SHA CI, fresh main lease, Pages and all three live markers must succeed before deployed claim. At this commit release is pending; follow-up handoff records outcome.

Next: actual current-SQL browser fixture with this overlapping collection schedule, larger transaction history and late-period switches during background completion. The stubbed48/24-sample results isolate client orchestration and cannot establish production DB lock/compute/network contention. Preserve264 barrier and first fresh result. Do not rerun rejected swing batch, total-first gate, concurrency2 or stale realized cache without new evidence. Operating intermittent latency remains unproven; do not claim eliminated.
