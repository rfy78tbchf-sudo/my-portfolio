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
