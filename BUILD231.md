# Build231 — Load legacy analysis only when expanded

Baseline: Build230, 12092004aa65712a957cc7626a3373f3057b9e04. Main CI 40654271764 and Pages 40654270666 succeeded; the performance branch has the same SHA. No newer work was found.

## Candidates
1. Hidden legacy analysis loads 31 additional requests on wealth entry: selected after measurement.
2. Monolithic initial HTML and service-worker cold/warm paths: remain to measure.
3. Full content rendering on navigation: defer until measured separately.

## Change
The wealth tab now requests its own dashboard without fetching the collapsed technical/legacy bundle. Opening that section starts the existing shared enrichment request. Restored open sections still load, including navigation during the initial home load. Existing error/retry, account/load generation guards and period calculations stay intact. Other tabs and explicit full refresh retain their existing contract. This change does not claim fewer requests on an explicit full refresh from wealth.

## Measurement
Five fresh synthetic sessions per version, Chromium 390x844 touch viewport, CPU4x, local 50ms response delay, real application read queue, service worker blocked. Click to displayed wealth amount plus two animation frames. These are not production server, compressed bandwidth or physical iPhone measurements.

| Metric | Build230 | Build231 |
|---|---:|---:|
| Requests after home-to-wealth entry | 32 each run | 1 each run |
| Wealth amount paint median (range) | 226ms (213–239) | 221ms (208–260) |
| Technical summary requests | 1 each run | 0 each run |

The timing ranges overlap: no proven visible speedup. The verified improvement is 31 avoided requests for hidden content. No requests are added on five subsequent home/wealth round trips; expanded analysis loads once and remains reusable. The first expansion performs the deferred work; it is not claimed to be faster. Errors still offer the existing explicit retry.

## Verification and next action
New browser fixture `node tests/build231_wealth_latency.mjs --verify` checks actual startup, closed-section request count, repeated navigation, explicit expansion and restored state in Chromium/WebKit. Without --verify it reproduces five timing samples; UI_SOURCE can select the baseline HTML. Existing build216 browser test now opens legacy analysis before expecting enrichment and checks hidden data is not fetched; it continues to cover shared pending work, errors/retry, background refresh and three mobile widths. Added VM coverage for navigation into wealth during startup, with closed and restored-open legacy sections. Existing wealth regression covers widths 390/402/430, 125%, scenarios, fixed baseline, monthly records and detail return.

Local Chromium and VM checks passed. Local WebKit lacks OS libraries; final-commit CI must pass before promotion. No live user data or writes were used. Recheck main SHA, fast-forward only after CI success, then verify Pages and HTML/SW markers `2026-10-28-wealth-reads-231` / `2026102810-231`.

Next: measure service-worker-enabled cold versus warm revisits, chart/detail input-to-paint and retained resources. Do not repeat layout-only inspections or claim live refresh speed from synthetic timings. Actual iPhone/PWA/Face ID/native keyboard remain untested.

### Before
```json
{
  "conditions": "5 fresh sessions, synthetic 50ms API delay per request, real three-request queue, Chromium 390x844 CPU4x, SW blocked; wealth click to displayed amount + two animation frames; not live server or iPhone timing",
  "samples": [
    {
      "run": 1,
      "wealthPaintMs": 213,
      "requests": 32,
      "technicalRequests": 1
    },
    {
      "run": 2,
      "wealthPaintMs": 239,
      "requests": 32,
      "technicalRequests": 1
    },
    {
      "run": 3,
      "wealthPaintMs": 238,
      "requests": 32,
      "technicalRequests": 1
    },
    {
      "run": 4,
      "wealthPaintMs": 214,
      "requests": 32,
      "technicalRequests": 1
    },
    {
      "run": 5,
      "wealthPaintMs": 226,
      "requests": 32,
      "technicalRequests": 1
    }
  ]
}
```
### After
```json
{
  "conditions": "5 fresh sessions, synthetic 50ms API delay per request, real three-request queue, Chromium 390x844 CPU4x, SW blocked; wealth click to displayed amount + two animation frames; not live server or iPhone timing",
  "samples": [
    {
      "run": 1,
      "wealthPaintMs": 221,
      "requests": 1,
      "technicalRequests": 0
    },
    {
      "run": 2,
      "wealthPaintMs": 218,
      "requests": 1,
      "technicalRequests": 0
    },
    {
      "run": 3,
      "wealthPaintMs": 228,
      "requests": 1,
      "technicalRequests": 0
    },
    {
      "run": 4,
      "wealthPaintMs": 260,
      "requests": 1,
      "technicalRequests": 0
    },
    {
      "run": 5,
      "wealthPaintMs": 208,
      "requests": 1,
      "technicalRequests": 0
    }
  ]
}
```
