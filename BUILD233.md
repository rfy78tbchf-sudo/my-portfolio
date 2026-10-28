# Build233 — Reuse unchanged chart window geometry

Baseline Build232 `445b625763faf60ea97e82058aa59ea574dd5daa`; main CI 40663483212 and Pages 40663481465 succeeded.

## Candidates and selected change
1. Pinch samples repeatedly rebuild the full price and moving-average polylines even when rounding produces the same visible window: selected after measurement.
2. Reopening detail fetches several sources: no caching added without freshness/invalidations measurements.
3. Retained chart nodes/listeners: measured separately; no accumulation found in this isolated fixture, so no cleanup rewrite.

`bindSecurityChart` now remembers the last rendered start/count for its own immutable points snapshot. Only range-dependent scale/polyline construction is skipped when the range is unchanged. Labels, selected price/date, accessibility state, cross focus/clear, controls and markers still update synchronously. New bindings/new price data always build new geometry. No frame deferral, event scheduling, network/cache or financial changes.

## Timing evidence
Five fresh Chromium pages per version, 365 synthetic daily points, mobile 390x844 CPU4x. Each run dispatches four synthetic subpixel pinch updates per animation-frame iteration for 60 iterations, then changes to three months. This deliberately exercises rounded duplicate ranges; it is not physical iPhone touch input, the whole application, or a live network benchmark.

| Metric | Before median (range) | After median (range) |
|---|---:|---:|
| Total synchronous handling for 240 updates | 1,565ms (1,261–1,672) | 757ms (701–946) |
| Per-run median interval to next animation callback | 31ms (25–33) | 17ms (17–20) |
| Moving-average layer reconstruction | 240 every run | 71 every run |
| Three-month period handler | 4ms (3–5) | 3ms (3–4) |

The callback interval is not a guaranteed presented-frame timestamp/INP; period-switch difference is too small to claim a benefit. Before/after select the same final range: start 272, count 93. The reliable improvement is eliminating 169 identical geometry rebuilds in this input sequence and reducing its handler CPU time. No claim about real iPhone speed or initial loading.

## Validation and continuation
New browser verification checks pinch results, same-window reset after keyboard selection, geometry identity and redraw when price data changes. Existing cross-focus regression passes locally in Chromium at 390/402/430px and 100%/125% with marker accuracy, clear/restore, touch/keyboard and saved settings unchanged. Final-commit CI runs these plus WebKit and all existing navigation, wealth and saved-judgment tests before main promotion. Version.json/HTML/SW release consistency passed locally.

A separate Chromium CDP run with forced garbage collection after 0/20/40 chart replacements observed documents=1, nodes=177, event listeners=43 each time. This bounds only the isolated chart fixture: it is not proof that the full application's heap, timers or detail flow cannot leak. `--retention` reproduces it; default benchmark runs five times and UI_SOURCE can select the prior HTML; `--verify` runs Chromium/WebKit regressions.

Recheck main SHA and fast-forward only after required CI, then verify deployed markers `2026-10-28-chart-window-233` and `2026102812-233`. Next: instrument full detail entry/return and actual chart input dispatch-to-paint; retain existing freshness rules rather than adding a broad detail cache. Live refresh and iPhone/PWA/Face ID/native keyboard timings remain unmeasured.

### Before raw samples
```json
{
  "conditions": "5 fresh Chromium pages; 365 synthetic daily prices; 390x844 touch viewport CPU4x; 60 frames x4 synthetic subpixel pinch events, then 3-month period; isolated production chart code, not real finger input or full app timing",
  "samples": [
    {
      "run": 1,
      "handlerTotalMs": 1556,
      "handlerMaxMs": 54,
      "frameMedianMs": 31,
      "redraws": 240,
      "periodMs": 4,
      "count": "93",
      "start": "272"
    },
    {
      "run": 2,
      "handlerTotalMs": 1567,
      "handlerMaxMs": 40,
      "frameMedianMs": 32,
      "redraws": 240,
      "periodMs": 5,
      "count": "93",
      "start": "272"
    },
    {
      "run": 3,
      "handlerTotalMs": 1672,
      "handlerMaxMs": 49,
      "frameMedianMs": 33,
      "redraws": 240,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    },
    {
      "run": 4,
      "handlerTotalMs": 1261,
      "handlerMaxMs": 31,
      "frameMedianMs": 25,
      "redraws": 240,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    },
    {
      "run": 5,
      "handlerTotalMs": 1565,
      "handlerMaxMs": 48,
      "frameMedianMs": 30,
      "redraws": 240,
      "periodMs": 5,
      "count": "93",
      "start": "272"
    }
  ]
}
```
### After raw samples
```json
{
  "conditions": "5 fresh Chromium pages; 365 synthetic daily prices; 390x844 touch viewport CPU4x; 60 frames x4 synthetic subpixel pinch events, then 3-month period; isolated production chart code, not real finger input or full app timing",
  "samples": [
    {
      "run": 1,
      "handlerTotalMs": 783,
      "handlerMaxMs": 26,
      "frameMedianMs": 17,
      "redraws": 71,
      "periodMs": 4,
      "count": "93",
      "start": "272"
    },
    {
      "run": 2,
      "handlerTotalMs": 946,
      "handlerMaxMs": 40,
      "frameMedianMs": 20,
      "redraws": 71,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    },
    {
      "run": 3,
      "handlerTotalMs": 701,
      "handlerMaxMs": 27,
      "frameMedianMs": 17,
      "redraws": 71,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    },
    {
      "run": 4,
      "handlerTotalMs": 748,
      "handlerMaxMs": 24,
      "frameMedianMs": 17,
      "redraws": 71,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    },
    {
      "run": 5,
      "handlerTotalMs": 757,
      "handlerMaxMs": 23,
      "frameMedianMs": 17,
      "redraws": 71,
      "periodMs": 3,
      "count": "93",
      "start": "272"
    }
  ]
}
```
### Separate retention observation (one run)
```json
{
  "conditions": "5 fresh Chromium pages; 365 synthetic daily prices; 390x844 touch viewport CPU4x; 60 frames x4 synthetic subpixel pinch events, then 3-month period; isolated production chart code, not real finger input or full app timing",
  "samples": [
    {
      "run": 1,
      "handlerTotalMs": 711,
      "handlerMaxMs": 28,
      "frameMedianMs": 17,
      "redraws": 71,
      "periodMs": 4,
      "count": "93",
      "start": "272",
      "retention": [
        {
          "opens": 0,
          "documents": 1,
          "nodes": 177,
          "jsEventListeners": 43
        },
        {
          "opens": 20,
          "documents": 1,
          "nodes": 177,
          "jsEventListeners": 43
        },
        {
          "opens": 40,
          "documents": 1,
          "nodes": 177,
          "jsEventListeners": 43
        }
      ]
    }
  ]
}
```
