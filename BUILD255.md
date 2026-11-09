# Build255 candidate — synchronous render scroll reuse

Status: candidate only; main remains deployed Build254 until exact-commit CI and comparison gates pass.

Nested performance rendering previously read scrollY after replacing content twice, forcing layout each time. Instrumented actual Chromium startup/refresh stacks attribute about 28–33ms per ordinary nested read. Capture the outer preserved scroll once per synchronous render call tree. Reset state in finally; later independent renders capture a new position. Input-active early returns still avoid geometry reads. No scheduling, financial calculation, cache, RPC or data changes.

`tests/build255_render_scroll.mjs` exercises the actual renderer with deterministic DOM behavior: nested restoration, no reads while input is active, depth reset after exceptions, fresh independent scroll, and navigation to top. Local Chromium all-account/stock, provisional labels and period retention passed at 390/430. Existing queue order/concurrency, superseded requests, update shell, resume and financial-state tests passed. CI must cover WebKit and existing mobile gates before promotion.

Synthetic comparison: actual startup/read queue, Chromium 390x844, 50 holdings, mocked response delay50ms, no CPU throttle, three samples/period/source; sequential source groups. Correct stock subtotal paint medians(ms): 1W598.6→547.7, 1M622.8→645.3, 3M584.3→499.1, ALL570.3→485.9. Each sample98 requests/one selected total. Raw samples preserve ranges and phase traces in performance/render255-{baseline,candidate}.json. 1M is inconclusive; alternating comparison is required, not a universal speed claim. These are synthetic transport timings, not production DB measurements or iPhone results.

Pending: alternating 1M comparison, exact-commit CI/Pages, browser scroll interaction coverage at402 and125% zoom. Do not deploy if input/scroll/layout gates fail or the gain remains uncertain. After acceptance, next scope is cold/cache reuse and rapid period switches with large synthetic transaction responses; do not re-open rejected batching/outer-tail guard work without new evidence.
