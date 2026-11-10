# Build267 experiment — explicit foreground priority still delays newly selected P&L

2026-11-10 KST. No release or product changes. Fresh main77e23e5577240eef097584f00dc4f1ee2b72552f(Build265), workbe7e6d7ca8ebe9a584e553a6d3ecd2531d60e851. Main CI42752497633 now successful, exact-SHA CI42749352465 and Pages42752496251 successful; no queued/running workflow among latest five. Public version.json HTTP200 matches265. Existing branch retained; no financial/account data queried or written, no broker calls. Unrelated supabase/.temp untouched.

## New candidate, not a repeat of266

Followed266's explicit-priority hypothesis in `experiments/scoped-priority267.mjs`. Generate isolated candidate with CANDIDATE_OUT, leaving index.html unchanged. Numeric ranks: existing P&L priority2 retains latest-first order; active initial security-detail quartet uses priority1 FIFO; ordinary reads remain0 FIFO. Only the four calls inside the current detail view use foregroundDetailRead; background thesis/decision calls are not elevated by RPC name. Recheck detail activity before a queued network call, preserve auth-owner checks and concurrency cap3. This fixes266's known overtaking of an already-queued P&L request without changing financial calculations or caching.

## Guard results

Actual app queue/rpc functions extracted into VM. Three occupied slots,50ms synthetic background/P&L responses; slow detail response500ms. Three alternating pairs/scenario. Times below are scheduler completion times, not browser paint, SQL or operating latency.

|Scenario|Baseline P&L median(range),ms|Candidate median(range),ms|
|---|---|---|
|P&L already queued before detail requests|50.41(50.32–50.91)|50.56(50.56–50.74)|
|P&L selected5ms after slots are released to pending work|95.73(94.59–95.82)|547.18(547.11–547.22)|

Raw performance/scoped-priority267.json retains dispatch order and peak concurrency. All retained scenarios preserve cap3 and complete their work; no requests disappear. Closed/superseded queued detail rejects SUPERSEDED_READ before transport,0 network calls. Owner change rejects AUTH_REQUIRED,0 network calls. Initial harness named a synthetic slow RPC without get_ and therefore bypassed the real read queue; the concurrency assertion caught it. Corrected name to get_detail_slow and reran all12 samples plus both guards without relaxing assertions.

The numeric queue correctly preserves priority of a P&L request that already exists. It cannot preempt the three slow detail requests it started earlier. With current ordinary ordering, three short background reads would have been active instead; the newly selected P&L would reach the next free slot about450ms earlier. This is a new blocking counterexample to the narrower266 follow-up, not another run of the old boolean-priority test. Reject this candidate too. Do not ship a version that makes newly selected period results wait for slow abandoned detail requests. No further browser benchmark/CI/redeployment is justified for this rejected candidate. Syntax check and scheduler guards pass; no WebKit or real-device verification claimed for the experiment.

## Next independent action

Investigate cancellation of in-flight read-only detail requests when the detail closes, changes security, or the auth owner changes. First trace the current fetchTimeout/authFetch/rpcNetwork signal and shared-history ownership paths. Build an intercepted-browser case: open slow detail, close it, immediately select1W/1M/3M/ALL; compare time until the correct result, active request slots, abort count, late-result rejection and reopened-detail behavior. Cancellation must free the scheduler slot, not only ignore the eventual result, and must not cancel shared requests still needed by another consumer. Keep writes, broker collection and calculation requests out of cancellation scope. Only consider scoped priority again after this independent obsolete-work cancellation has evidence and all first-P&L guards pass. Do not repeat either rejected priority benchmark unchanged or widen concurrency. If active shared consumers prevent safe cancellation, record that constraint instead of guessing.

Build265 remains deployed; intermittent hosted P&L latency and physical iPhone behavior are still open. This run supplies a rejected implementation and a concrete next bottleneck hypothesis, not a speed improvement completion claim.

Initial source trace for that next hypothesis: closeSecurityDetail increments detailEpoch and hides the modal; it does not abort transport. fetchTimeout creates its own controller and overwrites opts.signal, so merely passing a new signal would not work. readFetch retries AbortError after350ms, and initial detail failure falls back to loadDetailPrices; intentional cancellation must bypass both retry and fallback. These are source findings, not yet measured cancellation improvements. Preserve existing timeout retry and shared-history ownership when implementing a dedicated cancellation cause.
