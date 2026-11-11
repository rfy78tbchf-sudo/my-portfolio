# Build232 — Smaller update checks and one cached HTML shell

Baseline Build231 `1e5b9243e5cdd685a8be4494b29b943af0d6caf3`; main CI 40656029377 and Pages 40656028994 succeeded. No newer active work was found.

## Measured candidates and changes
1. Every startup/pageshow update check fetched the entire HTML, even on a warm revisit. Selected: fetch small `version.json` with the same no-store/cache-busting rule. Missing, invalid or failed manifest falls back to HTML. Network failure remains silent; applying an update still requires the explicit button and never automatically discards a draft.
2. Service-worker install cached both `./` and `./index.html`. Selected after cold measurements: retain only index.html, which the existing offline/5xx navigation fallback uses. A real service-worker test confirms failed root navigation still serves the cached app.
3. The large inline application itself remains: no speculative code split in this change.

No data calculations, load queues, auth, financial persistence, wealth records or layout changes. The new CI gate requires version.json, HTML build marker, appBuild and SW release number to agree; every future release must update all four.

## Measurement
Five cold/warm pairs for each stage. Real local HTTP server and service worker, synthetic session/accounts with 50ms API responses, Chromium mobile 390x844 CPU4x. Warm means the same browser context and activated service worker, followed by reload. No route interception disables browser caching. Cross-origin synthetic API keeps financial GETs outside the shell cache.

These are server response-body bytes without compression, not GitHub wire transfer sizes. Test HTML includes the synthetic instrumentation. No overall latency or real-iPhone speed claim. Network-response count varies by one service-worker update request; report ranges instead of treating this race as a performance gain.

| Metric | Build231 | Manifest only | Combined |
|---|---:|---:|---:|
| Update-check bytes, cold and warm | 652,950 | 43 | 43 |
| Cold total body bytes, median | 2,864,962 | 2,213,282 | 1,559,908 |
| Warm total body bytes, median | 1,383,128 | 730,630 | 730,625 |

Normal update checks remain one request. Cold HTML shell duplication is removed; warm request count remains 23 in this fixture. The first interaction is not deferred by these changes: no application execution is moved to an interaction. Missing manifest can cause two update requests (manifest + fallback HTML), intentionally preserving update detection.

## Validation and continuation
`tests/build232_update_latency.mjs` reproduces five cold/warm pairs; `UI_SOURCE` and `UI_SW` select baseline HTML/SW from git. `--verify` runs Chromium/WebKit with real service workers, checks current/new releases, 404/invalid JSON fallback, unavailable update responses, draft preservation and failed-navigation cached fallback. Local Chromium passed. The existing VM update test checks explicit application, cooldown/no-store behavior and release consistency. Existing mobile widths/125%, charts, returns and saved-decision regressions remain mandatory in CI.

Local WebKit needs unavailable system libraries; use final-commit CI before promotion. Recheck main SHA, fast-forward only, verify Pages and deployed HTML/SW/version.json. Markers: `2026-10-28-update-manifest-232`, `2026102811-232`.

Next: measure tab/detail/chart input-to-paint and repeated navigation resource retention; do not infer total startup or live refresh latency from the byte reduction. Real iPhone Face ID/native keyboard/PWA lifecycle and true production compressed transfers remain outside this measurement. Browser offline emulation did not reliably block service-worker fetches here; the regression therefore explicitly uses 503 server failures rather than claiming a real offline-device test.

### Baseline raw samples
```json
{
  "conditions": "5 pairs cold/warm;  real HTTP and service worker caching, synthetic session/API 50ms, Chromium 390x844 CPU4x; server response body bytes, no compression, not production wire bytes or iPhone timing",
  "samples": [
    {
      "run": 1,
      "cache": "cold",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 2862417,
      "controlled": true
    },
    {
      "run": 1,
      "cache": "warm",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 1383128,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "cold",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2864962,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "warm",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 1383128,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "cold",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2864962,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "warm",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 1383128,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "cold",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 2862417,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "warm",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 1383128,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "cold",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2864962,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "warm",
      "updateBytes": 652950,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 1383128,
      "controlled": true
    }
  ]
}
```

### Manifest only raw samples
```json
{
  "conditions": "5 pairs cold/warm;  real HTTP and service worker caching, synthetic session/API 50ms, Chromium 390x844 CPU4x; server response body bytes, no compression, not production wire bytes or iPhone timing",
  "samples": [
    {
      "run": 1,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2213282,
      "controlled": true
    },
    {
      "run": 1,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730630,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2213282,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730630,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2213282,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730630,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 2210737,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730630,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 53,
      "decodedBytes": 2213282,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730630,
      "controlled": true
    }
  ]
}
```

### Combined raw samples
```json
{
  "conditions": "5 pairs cold/warm;  real HTTP and service worker caching, synthetic session/API 50ms, Chromium 390x844 CPU4x; server response body bytes, no compression, not production wire bytes or iPhone timing",
  "samples": [
    {
      "run": 1,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 1559908,
      "controlled": true
    },
    {
      "run": 1,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730625,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 1559908,
      "controlled": true
    },
    {
      "run": 2,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730625,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 1559908,
      "controlled": true
    },
    {
      "run": 3,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730625,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 52,
      "decodedBytes": 1559908,
      "controlled": true
    },
    {
      "run": 4,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730625,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "cold",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 51,
      "decodedBytes": 1557368,
      "controlled": true
    },
    {
      "run": 5,
      "cache": "warm",
      "updateBytes": 43,
      "updateRequests": 1,
      "networkResponses": 23,
      "decodedBytes": 730625,
      "controlled": true
    }
  ]
}
```
