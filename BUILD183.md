# Build183 — Prioritize uncached home period essentials

Baseline: 7bea818d5b7cd30924b28d5476c9d342bec39f65 (Build182).

## Outcome and scope

The first uncached home period previously waited for all auxiliary analysis, including benchmark, FX attribution and ledger evidence, before displaying its headline and chart. This change starts only the summary, home chart and reliable-performance gate first. Once all three are ready for the selected period, the home becomes readable and auxiliary reads continue independently.

Prior-period auxiliary evidence is cleared before the new period is exposed. The legacy detailed-performance fallback waits for its auxiliary stage rather than drawing conclusions from partially replaced evidence. All application stages check period, request epoch, live account object and KST day. Revisiting an in-flight period can reuse its already-ready core. Only a fully successful result is cached by Build182's existing full-bundle cache.

Auxiliary read failures keep the core home result visible. A compact retry is available under the home asset-basis disclosure. Failure of an essential read still uses the existing period-local failure/retry screen. Performance formulas, DB state, trading records and judgment saving are unchanged.

## Verification

Isolated tests cover priority reads, readable home with deliberately blocked auxiliary responses, old evidence clearing, in-flight revisit, late-period/account/day exclusion, and auxiliary failure without whole-home failure. Build182 cache/retry, Build61 period/sales, Build180 loading and Build142/145/153 regression tests pass. Full mobile CI run 38054633227, job 114220468752, succeeded, including 390/402/430px blocked-auxiliary, cached-revisit and failure/retry journeys. Screenshot artifact 11670109132. Visually reviewed home-period-ready-390.png and home-period-auxiliary-retry-430.png: the headline remains readable while details are pending/failed; the retry is contained in the asset-basis disclosure. Core chart data alignment is tested in the isolated staged-response test.

Production commit 4b8b203752883c159aa8ad8decd3881714781072. Pages run 38054633165 succeeded. Retrieved deployed index.html and confirmed an exact local match: SHA-256 d3fe517d2ed05247b66214fc98218e77d5355110a52cb1b7fb6aab823a9e6665. Implementation, synthetic mobile and deployment verification are complete; signed-in physical iPhone behavior remains confirmation needed.

No real account test writes or real iPhone timing claims. Synthetic data and controlled latency checks are separate from physical-device daily use.

Controlled comparison used separate VM contexts for Build182 and Build183, the same synthetic three-read queue, 40ms ordinary reads and a 600ms benchmark response. Home became ready at 743ms before / 43ms after; all details completed at 743ms before / 765ms after. The gain is earlier useful content, not faster database calculations; staging can slightly extend the final auxiliary completion time. This does not measure actual account or iPhone/PWA latency.

## Remaining priority

This targets user-selected uncached home periods. Initial full account enrichment still has its broader startup dependency chain; it has not been declared optimized by this change. Next assess first authenticated opening and ordinary revisit together, retaining last-confirmed summary and verifying the actual iPhone/PWA path before expanding analysis features.
