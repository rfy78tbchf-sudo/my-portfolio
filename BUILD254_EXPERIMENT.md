# Build254 experiment — not deployed

2026-11-09 KST. Continues Build253 next hypothesis. Main bbe82e7 / live Build253, work0b0ac45; Pages42614938566 and exact-SHA work CI42613003569 passed. Main duplicate CI42614938993 was still running at initial check. No newer active development branch found. No production code, schema, financial rows or version markers changed.

## Candidate and evidence

Evaluated at most three candidates: global flat history query (rejected for truncation), per-parent embedded batch (implemented as isolated prototype), and existing individual requests (baseline). Source: `experiments/swing254.mjs`; measured samples: `performance/swing254-experiment.json`.

Production metadata read confirmed daily_security_prices_security_id_fkey references securities(id). A read-only Data API request for nonexistent UUID returned200/[] with the embedded query, confirming relation syntax only, not signed-in result equivalence. No actual account/holdings rows were read. Supabase changelog reviewed; no client library or schema change. PostgREST embedding/per-parent limit documentation: https://docs.postgrest.org/en/stable/references/api/resource_embedding.html .

Isolated Node VM with the actual Build253 loadSwingPrices baseline and prototype:50 synthetic securities,0/43/200 history rows, mixed currencies,160-row per-security maximum, duplicate holding and zero-quantity exclusion,50ms mocked transport. Five alternating runs normal; three runs each failure condition. Max concurrency3. Exactly one final alert update/render. Byte-equivalent output across normal, failed batch, missing parent, duplicate parent, and individual failure scenarios. Flat1000-row global cap fails per-security history preservation and is rejected.

| Condition | Before median (min–max), ms | Candidate median (min–max), ms | Requests before→after |
|---|---:|---:|---:|
| Normal,5 runs/version |856.5 (855.2–857.2)|101.6 (101.2–101.9)|50→5|
| Batch unavailable,3 runs/version |854.5 (853.9–855.1)|1106.2 (1104.0–1106.8)|50→55|

These are isolated loader measurements, NOT browser paint, real RPC/DB/network, or deployed improvement. The candidate's chunk-local serial fallback recreates a longer critical path on failed batches. Do not deploy this prototype. Memory peaks, parent/child authorization parity with a signed-in session, first interaction, full refresh, Chromium/WebKit and mobile layout still require candidate validation.

## Concrete next action

Replace chunk-local fallback with a shared bounded individual-read pool and avoid sending remaining grouped requests after an unsupported/failed grouped route. Test small4 and large50 holdings with one and all failed batches, missing/truncated parents, session change and late results. Reuse the existing comparison harness only after that failure-path regression is resolved; preserve per-security160-row chronology and alert timing. Then compare correct P&L paint, full refresh completion, request/response size and memory in both browsers. No new UI and no inferred zero history. Do not repeat Build253 refresh-priority work or report Build254 as deployed.

## Shared-pool follow-up — 2026-11-09, still not deployed

Fresh refs remain main bbe82e7/Build253 and performance work6774faf. Main CI42614938993 now passed. A separate active `work/trust-reconciliation-253` branch at f5da527 is integrating NAV reconciliation as Build254; its CI42617229111 failed at the owned date evidence step. Do not overwrite, duplicate, or promote that work from this experiment. Reconcile with its latest main before any eventual application change. Live version.json still reports253.

Implemented the recorded next hypothesis in the isolated candidate: a shared dynamically replenished three-slot pool; one batch failure disables further bulk dispatch within that invocation; queued failed securities go back through the shared individual-read pool. A late failure can restart all free slots rather than falling back serially on one surviving worker. Portfolios of10 or fewer securities use the original individual route. Production index.html, schema and markers remain untouched.

Expanded byte-equivalence checks include a delayed single batch failure after other workers can finish, all batch failures, missing/duplicate parent results, individual read failure, zero-history and short-history securities, duplicate/zero holdings and per-security160-row ordering. All passed, maximum concurrency3, one final alert update/render. Actual authenticated parent/child RLS parity and owner transition remain unverified, not assumed.

Same VM, same mocked50ms transport; five alternating normal samples and three failure samples/version. This is a new implementation comparison, not a repeat of unchanged candidate timings.

| Holdings/condition | Baseline median (min–max) ms | Shared pool median (min–max) ms | Requests |
|---|---:|---:|---:|
|4 normal|101.0 (100.8–101.3)|100.9 (100.0–101.5)|4→4|
|4 batch unavailable|100.9 (100.9–100.9)|101.1 (100.9–101.9)|4→4|
|50 normal|856.3 (855.4–856.8)|101.4 (100.8–101.8)|50→5|
|50 batch unavailable|855.5 (855.5–855.9)|905.4 (905.2–906.5)|50→53|

Raw samples: performance/swing254-pool4.json and swing254-pool50.json. Previous prototype failure median1106.2ms is historical, not the baseline for this run. Small portfolios no longer attempt the speculative batch. Large-portfolio failure overhead is reduced but still present: three already-dispatched batches fail before individual recovery, adding about50ms and three requests. No deployed performance claim, no memory or full-browser claim.

Next: evaluate a capability/circuit-breaker scoped to the authenticated session so a failed grouped route is not reprobed on every refresh; distinguish unsupported schema/permissions from transient failures, reset on owner/auth change, and verify late old-owner responses cannot alter the new owner's capability state. Quantify first failed probe and subsequent refreshes separately. If the failure-path request/latency cost cannot be justified, retain individual reads and move to the measured repeated-render hypothesis. Only then run both-browser full-refresh/P&L paint and memory comparisons against the latest reconciled main; reserve the actual next build number after the trust branch lands.
