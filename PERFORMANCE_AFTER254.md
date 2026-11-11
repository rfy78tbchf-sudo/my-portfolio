# Performance follow-up on deployed Build254 — 2026-11-09 KST

Fresh main5c0064968a9bb384676c12a9a8dfbe9834b22d07, successful main CI/Pages42623515532 and42623514810; live version.json2026-11-09-nav-trust-254 verified. Read BUILD254.md and incorporated main into the existing performance branch without conflict. Preserve its shared date boundaries, all-account default, unverified whole-account P&L status and snapshot safeguards. No production source change beyond incorporating already-deployed main. No operational financial reads/writes this run.

## Hypotheses tested (two)

1. Session-scoped batch failure gate: isolated `experiments/swing-session-gate.mjs` tests transient cooldown expiry, unsupported-route suppression, owner changes, logout/login and old-owner late failures. Gate state contains no financial values. All assertions pass. This only addresses repeat probes; it does not remove the first failed batch's additional requests measured in BUILD254_EXPERIMENT. It is not wired into production and has no new measured end-to-end gain. Keep batching shelved rather than extending a speculative protocol optimization indefinitely.
2. Redundant final render: `experiments/render-after254.mjs` runs the actual current startup/read queue/renderers with intercepted synthetic data and explicitly selects stock scope after Build254's default scope change. Chromium,390x844,50 holdings,50ms mock responses,no throttle,1W,five refresh samples. Correct subtotal paint median562.9ms (537.7–580.1); full completion2218.5ms (2155.4–2260.6); outer render sum383.0ms (352.1–403.5);9 renders,98 requests,one selected total in every sample. Raw traces in performance/render-after254.json. These are current diagnostic samples, not a before/after release comparison, not real DB timings or all-account P&L verification. Local timings cannot be compared to the prior CI host.

The final two paints are adjacent in normal responses. However `experiments/swing-render-boundary.mjs` extracts the actual loader and holds the unrelated flow-basis promise. Baseline paints completed price alerts before flow-basis completion; a candidate removing the loader render does not. Both eventually paint after release. Removing that render therefore delays a first useful display and is rejected. No deployed speed claim, no new version, no memory/physical iPhone claim.

## Next concrete action

Stop the batch/cooldown experiment unless real grouped-route evidence changes its tradeoff. Profile the ~93–106ms second render in these traces, distinguishing CPU construction from forced layout/scroll restoration. Instrument existing render phases on Build254 or newer main with synthetic data; measure same-host alternating versions before changing behavior. Only coalesce updates proven to occur before the same presentation frame and retain early alert display when another lane stalls. Revalidate both all-account and stock scopes, rapid period changes and the established Chromium/WebKit/mobile gates before promotion. Do not repeat baseline-only measurements or revert Build254's financial contract to make old fixtures pass.

## 23:16 KST follow-up — nested-render hypothesis tested

Fresh main remains 5c0064968a9bb384676c12a9a8dfbe9834b22d07; CI/Pages runs 42623515532 / 42623514810 succeeded, no active run in the latest five. Live version is still 2026-11-09-nav-trust-254. Existing branch continued from c86d61f905df7111ef6ee5fe16ba3c67168fdb46. No operational financial data used.

Added function/DOM/scroll phase and recursive stack instrumentation in `experiments/render-phases254.mjs`. Actual call stacks establish synchronous render recursion: render → bindBrokerDay → changeStockPeriod → render → bindBrokerDay → loadStockRealized → render. This is distinct from the previous asynchronous final-alert render hypothesis. DOM construction itself is small in these samples; active-period geometry reads take roughly 29–44 ms in ordinary samples. This timing includes browser layout work, not just the function's arithmetic; uninstrumented gaps remain, including reads before phase wrappers. Do not attribute all remaining time to calculation or DB work.

Implemented an isolated epoch-guard candidate (`experiments/render-nested-candidate254.mjs`) which skips the outer render tail after a nested render replaces the content. **Rejected for production:** it does not establish an end-to-end improvement and could skip restoration of captured expanded/scroll state. Production index.html is unchanged.

Same host, Chromium 390x844, 50 synthetic holdings, 50ms mocked responses, no CPU throttling, stock-only 1W refresh, five samples per clean run. Candidate then clean baseline (not randomized paired trials):

| Metric (ms) | Baseline median (range) | Candidate median (range) |
|---|---|---|
| Correct subtotal paint | 538.8 (530.2–611.1) | 544.0 (534.2–592.6) |
| Refresh completion | 2165.8 (2146.3–2248.9) | 2210.0 (2186.7–2232.8) |
| Outer render total | 361.6 (333.9–444.3) | 392.3 (365.1–426.5) |

Raw data: performance/render-phases254-{baseline,candidate}.json. This is synthetic browser timing, not operating DB/RPC performance. A preliminary baseline encountered a temporary-file cleanup collision because separate command PID namespaces reused process.pid; excluded it from the table and changed the wrapper to UUID filenames, then reran cleanly. No browser regression release claim, WebKit or physical-iPhone claim, no new deployment.

Next: stop outer-tail skipping. Instrument scrollY/contentInputActive reads before recursive render construction, which current phase wrappers do not cover, and test initializing deferred-loading state before DOM construction to prevent recursion without postponing network requests. Preserve loading/provisional display, expanded sections and scroll. Only pursue implementation after a same-condition gain, then cover 1W/1M/3M/ALL, both scopes, cold/reused caches and rapid switches, and the established two-browser/mobile gates. Do not repeat this rejected guard experiment.
