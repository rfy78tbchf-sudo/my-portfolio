# Period query follow-up — no Build259 release

2026-11-10 KST. Fresh main c3f04cb / work414a55e / live2026-11-10-empty-period-items-258. Exact CI42693003841, duplicate main CI42695432287 and Pages42695429969 all successful; recent workflow list has no ongoing code/deploy runs. Continued existing work/performance-detail-render-234. No application/schema/version/operational financial changes. This file is an experiment label, not a deployed build.

## Hypothesis1: one snapshot and one stock calculation

Implemented isolated local prototype in experiments/combined-period259.mjs. Current stock258 and realized257 execute on PGlite with the existing fixed-date synthetic fixture. The prototype supplies the computed stock JSON to a diagnostic-only realized function within a materialized single-statement CTE. It is not exposed/deployed and does not cache across requests. Full stock+realized outputs equal separate calls in all80 samples:300/3000 transactions ×1W/1M/3M/ALL ×5 alternating pairs. Both SQL plans warm, same fixture and engine. NAV stubbed. No browser or network claims; this SQL gate rejects the candidate before UI implementation.

3,000 transactions, milliseconds, median(min–max):

|Period|Separate first total|Combined first total / both results|Separate both results|
|---|---|---|---|
|1W|134.1(124.9–135.9)|396.3(395.5–410.3)|519.4(511.5–532.6)|
|1M|131.4(128.7–162.2)|385.9(380.1–399.3)|514.7(509.2–598.8)|
|3M|152.6(145.5–162.8)|454.4(432.4–468.3)|608.0(585.8–631.5)|
|ALL|301.0(287.6–311.5)|734.3(671.2–761.5)|989.1(955.9–1031.9)|

Small300-transaction first-total medians1W/1M/3M/ALL:39.1/37.0/36.9/49.5→72.0/62.9/85.0/93.0ms. Raw performance/combined-period259.json records every sample. Five pairs do not establish tail percentiles. First total is SQL-result availability, NOT paint time. Although total work falls, the formerly earlier total is blocked by realized computation. Two failure probes additionally show an injected realized exception discards the successful stock total in the combined request; independent stock remains successful. Reject this monolithic response. Do not deploy or remove independent error behavior to obtain a faster all-results benchmark. No need to run full deployment CI for a candidate already violating first-result and partial-failure requirements.

## Hypothesis2: concentrated long ledger history

Advanced beyond the rejected combination in the same execution. experiments/ledger-shape259.mjs holds total transactions3000, sales1500, quantities/prices/fees/currency/FX constant, changing distribution100/10/1 securities and30/300/3000 consecutive daily transactions per security. ALL, same fixed2026-11-09 date, current SQL, representative indexes, PGlite, NAV stubbed. Five warmed full-result repeats per shape. Independently asserted summed realized local profit15000USD and1500 sale rows; entire response stable within each shape.

|Securities|Daily transactions per security|ALL median(min–max),ms|
|---|---|---|
|100|30|692.5(676.7–741.1)|
|10|300|1020.1(950.5–1075.5)|
|1|3000|5925.0(5555.5–6162.0)|

Raw performance/ledger-shape259.json. Dates necessarily span different lengths; this is a workload-shape sensitivity experiment, not a before/after optimization or proof of the user's operating bottleneck. SQL code inspection finds the realized function groups per-security days, then rereads that security's transactions separately for each day using recovered-date coalesce expressions. Nested stock also runs: this measurement does NOT yet attribute the6s to either part. Do not silently treat the scan hypothesis as proven or claim an improvement.

## Concrete continuation

Keep live Build258 and the rejected cache/concurrency constraints. Next action: instrument current realized257 phase boundaries and nested stock on the new1-security/3000-day case; compare with100-security/30-day case. Then test reusing each day's selected trade records inside the same query (preserving mixed-day order by id versus ordinary trade_at,id, exact numerics, reconstructed dates, unknown flags and account scope) only if per-day rescans dominate. Quantify temporary memory/serialization cost and small-history regression. Do not add an index without a matching measured plan, truncate history, infer historical cost from current holdings, or return zeros for unknowns. Combined RPC is deferred until early-total and independent-failure behavior can be retained. No browser speed, iPhone validation, new CI gate, or new deployment is claimed by this experiment.
