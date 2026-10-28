# Build230 — Defer Excel parser execution until upload

Baseline main: 00b65c053f7ff5ecd9ec3b3bd3299bcea9f9c137 (Build229).
Baseline main CI 40643632056 and Pages 40643631246 succeeded. No newer performance branch/run was found. Existing unmerged branches are historical, not a new implementation.

## Candidates and chosen change
1. Eager JSZip execution on every visit despite only XLSX import using it: selected.
2. Approximately 640 KiB monolithic HTML: investigate separately; no speculative splitting.
3. Full content rerender on tab change: measure before changing preserved navigation state.

Only XLSX parsing now loads JSZip. CSV remains independent. Concurrent imports share one promise; failed loads can retry, and script nodes/handlers are removed. The service worker still precaches the library to preserve existing offline availability: this is a foreground execution reduction, NOT elimination of the installation download. No financial calculation, DB write, session or layout changes.

## Reproducible evidence
`node tests/build230_startup_latency.mjs`: five fresh Chromium contexts, 390x844 touch viewport, CPU 4x, local synthetic API responses, service workers blocked. Response body byte counts are decoded file sizes (including update checks), not wire transfer sizes. Benchmark contains synthetic accounts only.

| Metric | Before median (range) | After median (range) |
|---|---:|---:|
| Script execution ms | 51 (48–56) | 23 (22–27) |
| DOMContentLoaded ms | 382 (374–433) | 407 (364–420) |
| Same-origin response count | 6 | 5 |
| Decoded response bytes | 1,459,291 | 1,362,368 |

Document readiness did not improve: do not claim faster total startup or a measured iPhone gain. Repeat synthetic refresh benchmark: assets 43ms, home complete 515ms, 17 reads (3-run medians); not live backend timing. First XLSX interaction now incurs library execution; offline bytes remain precached and later imports reuse it. Functional retry/concurrency verified; first-import timing is not yet benchmarked.

## Validation and continuation
Local Chromium actual workbook parsing, concurrent loading, failed load/retry, CSV independence, upload guards, refresh isolation, startup staging, wealth arithmetic/identity passed. Full existing required CI includes Chromium/WebKit, widths 390/402/430 and 125% wealth/navigation checks; new actual XLSX browser test is in that same required workflow. Local WebKit lacks shared system libraries; rely on successful final-commit CI before main promotion.

Next: measure cold and warm startup with service worker enabled, first XLSX interaction, tab/detail/chart input paint timings and live refresh separately. This run does not establish warm-cache timing, long-task counts, retained memory, or actual iPhone Face ID/native keyboard/PWA lifecycle. Keep financial fixtures isolated. Recheck main SHA, fast-forward only after required branch CI success, then confirm Pages and HTML/SW build markers before claiming deployed.

### Raw before samples
```json
{
  "conditions": "5 fresh contexts; synthetic startup; Chromium 390x844, CPU 4x, locally fulfilled responses, SW blocked; decoded bytes, not compressed wire bytes; not real iPhone/server timing",
  "samples": [
    {
      "run": 1,
      "requests": 6,
      "decodedBytes": 1459291,
      "scriptMs": 51,
      "dclMs": 388
    },
    {
      "run": 2,
      "requests": 6,
      "decodedBytes": 1459291,
      "scriptMs": 51,
      "dclMs": 382
    },
    {
      "run": 3,
      "requests": 6,
      "decodedBytes": 1459291,
      "scriptMs": 51,
      "dclMs": 382
    },
    {
      "run": 4,
      "requests": 6,
      "decodedBytes": 1459291,
      "scriptMs": 56,
      "dclMs": 433
    },
    {
      "run": 5,
      "requests": 6,
      "decodedBytes": 1459291,
      "scriptMs": 48,
      "dclMs": 374
    }
  ]
}
```
### Raw after samples
```json
{
  "conditions": "5 fresh contexts; synthetic startup; Chromium 390x844, CPU 4x, locally fulfilled responses, SW blocked; decoded bytes, not compressed wire bytes; not real iPhone/server timing",
  "samples": [
    {
      "run": 1,
      "requests": 5,
      "decodedBytes": 1362368,
      "scriptMs": 23,
      "dclMs": 407
    },
    {
      "run": 2,
      "requests": 5,
      "decodedBytes": 1362368,
      "scriptMs": 24,
      "dclMs": 410
    },
    {
      "run": 3,
      "requests": 5,
      "decodedBytes": 1362368,
      "scriptMs": 22,
      "dclMs": 420
    },
    {
      "run": 4,
      "requests": 5,
      "decodedBytes": 1362368,
      "scriptMs": 22,
      "dclMs": 394
    },
    {
      "run": 5,
      "requests": 5,
      "decodedBytes": 1362368,
      "scriptMs": 27,
      "dclMs": 364
    }
  ]
}
```
