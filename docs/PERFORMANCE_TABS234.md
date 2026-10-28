# Build234 tab baseline — 2026-10-29 KST

Continued existing work/performance-detail-render-234, starting at9a1e27a (CI40719139987 success). Main716448a remains Build234. Checked latest branches/runs; no overlapping implementation or active CI was found. HTML/SW/version manifest match the existing release. No app source, financial logic or deployment is changed.

Five fresh Chromium sessions, 390x844 CPU4x, same synthetic fixture and50ms API delay, service workers blocked. Three rounds of portfolio→performance→analysis→home per session. Initial home load finishes before measuring. Values are click through idle/required reads plus two rAF callbacks, not presented paint/INP or actual iPhone/server times. API response sizes/real network timings were not measured. This is a baseline, not a before/after improvement.

| Tab | First round ms(range) / requests | Second | Third |
|---|---:|---:|---:|
| portfolio | 930 (852–974) / 31 | 130 (127–142) / 0 | 133 (128–139) / 0 |
| performance | 434 (383–461) / 4 | 109 (109–141) / 0 | 125 (122–142) / 0 |
| analysis | 225 (210–275) / 1 | 143 (126–161) / 0 | 143 (126–158) / 0 |
| home | 76 (74–91) / 0 | 91 (75–92) / 0 | 77 (76–93) / 0 |

First portfolio content (four synthetic holding rows and displayed1,000,000 amount, plus two rAF callbacks): 164 (136–198)ms. This happens before the broad enrichment finishes; do not call the full idle timing a blocked/blank screen. Each first portfolio entry starts31 reads; first performance4, wealth1; all later rounds0. Read names are in the raw samples. `daily_security_prices` appears four times because it reads different securities, not proof of duplicate identical requests.

## Candidates and decisions
1. Portfolio starts the shared enrichment bundle:31 requests including technical, risk, reconciliation, benchmark, ledger and per-security price data. Source audit confirms bindDeferredDetails starts ensureDetails for portfolio/performance, and livePortfolio already constructs holding rows from core values. This is the most promising next candidate, but simply moving all31 to the next tab would transfer cost. Before implementation audit downstream price/technical consumers and test separate quote readiness, failed/retried reads, performance first interaction and data freshness. Do not remove data dependencies based only on the visible rows.
2. Repeated-tab request cache: all five first-to-third sequences reused completed data without extra reads after the initial round. No new cache or wider TTL is justified.
3. Late wealth response: the gated rapid-navigation regression returns home while the wealth request is pending, releases it, verifies the home DOM node remains unchanged, then reenters wealth and verifies only one dashboard read. Current code already guards the current tab and reuses completed data; cancelling this shared request is not justified by these observations.

After each home return/forced GC, all15 samples retain documents2/nodes817/listeners94. This is bounded DOM stability, not proof of no total-heap/timer leaks. Full startup cold/warm byte measurements remain separate.

## Validation and handoff
`node tests/tab_runtime_profile234.mjs` runs the five-session baseline. `--verify` runs one session per Chromium/WebKit plus the gated rapid-navigation case; CHROMIUM_ONLY=1 restricts local verification. Local Chromium passed. Local WebKit cannot launch because OS libraries are missing; CI installs both and now runs this test. Check the diagnostic commit CI next; no main promotion is intended. Previous main and previous measurement-branch CI passed both engines.

Next: isolate portfolio's actual price/technical dependencies from the shared31-request enrichment and compare a targeted split under the same sequence, including first performance/wealth use. Preserve retry, load epochs, data timestamps, search/sort/currency and detail return. Reject a split that merely shifts equal work into the next required action without a supported benefit. No actual user DB writes, balances, identities or judgments were used.

## Dependency audit and early-price experiment — 2026-10-29 KST
Starting branch3496c8a passed both-engine CI40729069769. Main remains716448a/Build234 and all three live deployment markers match. Continued the same branch without a new release.

The list's valuation/quantity/P&L uses core holdings and display basis; quote dates use priceMeta populated by loadHomeReviewData. app-enhancements only adds its panel on more. However livePortfolio ALSO appends portfolioReviewSection and homePriceWatchCard. The latter calls homePriceWatchData, which requires per-security160-point swingPrices (not merely latest21-day quotes). loadSwingPrices issues one request per positive holding security, and updateSwingAlerts computes state/notifications from those histories. The visible four-row fixture must not be mistaken for the entire portfolio dependency graph. A blanket removal of enrichment would leave the price-watch section incomplete.

Candidates: (1) drop all31 portfolio reads: rejected by this dependency audit; (2) start independent swing price reads at enrich entry and reuse that promise at the existing completion join: measured below and rejected for uncertain benefit; (3) new cache/cancellation: still unwarranted given zero repeat reads and already guarded late wealth response. No calculation or alert definition changed.

Candidate2 was tested only in a temporary HTML file via UI_SOURCE. Exact transformation: in loadLiveDetails change `function enrich(){return Promise.all([` to `function enrich(){var earlySwing=loadSwingPrices(target);return Promise.all([`; replace the completion join's `loadSwingPrices(live)` with `earlySwing`. No new calls or concurrency limit change. The three-worker price loader shares the existing bounded request queue with other reads, so moving its start does not eliminate total work.

Five fresh Chromium sessions before and five after, each three tab rounds, same390x844/CPU4x/50ms mock delays/cache/SW/fixture and harness, sequential batches. Metric ranges overlap:

| First-round metric, median(range) ms | Current app | Temporary early swing |
|---|---:|---:|
| Holding content plus two rAF | 148 (142–183) | 157 (121–251) |
| Four swing histories loaded | 899 (853–946) | 854 (792–1025) |
| Portfolio idle plus two rAF | 917 (881–974) | 940 (884–1133) |
| Next performance idle plus two rAF | 494 (397–501) | 463 (406–527) |
| Next wealth ready plus two rAF | 244 (241–289) | 275 (225–293) |
| Portfolio request count | 31 every run | 31 every run |

Swing readiness is the test hook observing four populated result keys, not a presented frame, proof of valid history, or real network latency. The fixture is synthetic and does not certify financial/alert correctness; those existing regressions were not replaced. Overall readiness and first displayed holdings do not improve. Do not claim the45ms median difference in swing completion is a reliable benefit. App code and release markers remain unchanged. Raw results are in PERFORMANCE_PORTFOLIO_DEPENDENCIES234.samples.json.

Local Chromium tab/late-response verification was rerun against the unchanged app. CI runs the diagnostic harness in both engines; check this commit's result at next start. No main merge/deployment is intended. Existing main and preceding branch CI remain successful.

Handoff: mark blanket portfolio deferral and early-swing scheduling as closed candidates unless new evidence changes the workload. The next useful measurement is refresh/resume under a controlled slow response and rapid tab changes, capturing click responsiveness/long tasks while requests remain pending, rather than more idle-only tab benchmarks. Preserve shared request owners, failure/retry and actual timestamps. A more invasive enrichment partition needs a concrete consumer map and demonstrated user-flow benefit before product implementation.
