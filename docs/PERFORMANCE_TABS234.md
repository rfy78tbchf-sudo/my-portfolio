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
