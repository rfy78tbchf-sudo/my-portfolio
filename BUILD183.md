# Build183 — Prioritize uncached home period essentials

Baseline: 7bea818d5b7cd30924b28d5476c9d342bec39f65 (Build182).

## Outcome and scope

The first uncached home period previously waited for all auxiliary analysis, including benchmark, FX attribution and ledger evidence, before displaying its headline and chart. This change starts only the summary, home chart and reliable-performance gate first. Once all three are ready for the selected period, the home becomes readable and auxiliary reads continue independently.

Prior-period auxiliary evidence is cleared before the new period is exposed. The legacy detailed-performance fallback waits for its auxiliary stage rather than drawing conclusions from partially replaced evidence. All application stages check period, request epoch, live account object and KST day. Revisiting an in-flight period can reuse its already-ready core. Only a fully successful result is cached by Build182's existing full-bundle cache.

Auxiliary read failures keep the core home result visible. A compact retry is available under the home asset-basis disclosure. Failure of an essential read still uses the existing period-local failure/retry screen. Performance formulas, DB state, trading records and judgment saving are unchanged.

## Verification

Isolated tests cover priority reads, readable home with deliberately blocked auxiliary responses, old evidence clearing, in-flight revisit, late-period/account/day exclusion, and auxiliary failure without whole-home failure. Build182 cache/retry and Build61 period/sales tests pass. Browser coverage added at 390/402/430px for blocked auxiliary analysis, visible headline/chart, auxiliary failure and retry. Full CI, screenshot inspection and deployment verification pending.

No real account test writes or real iPhone timing claims. Synthetic data and controlled latency checks are separate from physical-device daily use.

## Remaining priority

This targets user-selected uncached home periods. Initial full account enrichment still has its broader startup dependency chain; it has not been declared optimized by this change. Next assess first authenticated opening and ordinary revisit together, retaining last-confirmed summary and verifying the actual iPhone/PWA path before expanding analysis features.
