# Build261 — reuse sale quantity formatter within one render

2026-11-10 KST. Continues Build260's recorded CPU-throttled render hypothesis. Fresh main a67fbe47803f7add4a180c2182bc3b501dc64d50, work handoff7d1e13c7eb51cc1021b9460e6a70b83b45bd4a6c, required CI42717690775 and Pages42719661311 successful. Main's additional same-SHA CI42719662348 also completed successfully. Live version.json confirmed Build260 before editing; no competing branch change. Existing work branch reused.

## Attribution and change

CPU4x Chromium revealed two long realized-view renders for ALL. The dominant measured function was stockRealizedEvidenceHtml (~90–100ms per call in representative samples), not row financial aggregation. Candidate hypotheses were quantity formatting, repeated aggregation, and DOM reconstruction; choose formatting first because it preserves every element and avoids financial result caching. The former quantity `num` called toLocaleString with a new options object per sale; use one Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format within each evidence-render call. No cross-render cache, deferred details, calculation/rounding/currency/source-time changes, DB migration, operational write, or UI layout change. Finite coercion and '-' for nonfinite values preserved. Formatter is not retained after the call. DOM size and request counts remain equal; this is not a formal memory-leak measurement.

## Same-condition comparison

Chromium140 / Playwright1.55.1,390×844,CPU4x,50ms simulated transport,3000 synthetic trades / one security, fixed date2026-11-09. Actual realized259 and nested stock260 SQL in local PGlite, NAV stubbed; independent stock-view API remains a fixed synthetic response. SQL plans warm, period application cache cleared per sample. Five alternating source pairs per period (40 selections), full returned result and visible sum checked. All samples retain one realized and one independent total RPC. Raw performance/realized-format261.json; reproduce with BASELINE_UI and CANDIDATE_UI paths using experiments/realized-format261.py. Baseline source is git show a67fbe4:index.html, candidate is this commit's index.html. Small version-marker differences are not the optimization. Early overlapping exploratory runs were discarded; recorded final comparison and interaction checks ran sequentially without competing local benchmarks. Five samples do not support tail percentiles or operating-server/iPhone claims.

|Period|Request→correct paint before median(range),ms|After median(range),ms|Summed render before→after median,ms|≥50ms long tasks before→after,total5runs|
|---|---|---|---|---|
|1W|330.7(302.9–386.0)|311.2(286.0–344.2)|57.7→57.1|1→0|
|1M|325.1(306.7–349.4)|311.7(270.6–324.1)|64.2→54.2|1→0|
|3M|312.9(301.8–359.6)|316.0(309.5–333.3)|63.7→55.8|0→0|
|ALL|717.0(624.9–754.8)|617.0(563.5–640.9)|320.4→105.8|10→3|

ALL improves clearly in render cost; total request-to-paint ranges overlap at their edges because SQL/runtime variance remains. Shorter periods overlap and are not claimed improved. Combined render duration includes a later render after first correct paint and must not be called one blocked task. Three long tasks remain in five ALL candidate runs: this is not a claim that every stutter is fixed. Per-sample queue, RPC, SQL, response-to-paint, function costs, DOM count and uncompressed payload bytes are in raw data; fixed latency does not emulate bandwidth.

## First interaction and regression

Separate sequential before/after checks, same CPU4x/viewport/data/transport, three runs per period, actual Playwright click on the outer sale summary to two animation frames: first-click paint medians1W/1M/3M/ALL25.2/25.6/24.0/26.4→25.8/21.8/24.7/25.5ms. ALL ranges25.6–27.5→25.4–26.5ms. No first-expansion delay was moved into an on-demand load. Full detail exists before clicking; expanded state verified. Raw performance/realized-interaction261-{baseline,candidate}.json. Additional programmatic open timings are separate from actual clicks. Initial diagnostic selector incorrectly matched nested summaries; narrowed to the outer summary and discarded failed samples. An initial diagnostic string-quoting error was also fixed before clean runs; neither required a product change.

60 whole-evidence HTML differential checks across en-US,ko-KR,de-DE,ar-EG cover null/undefined/empty/nonfinite/negative/large/fractional quantities and1500 mixed estimated/pending sales with escaped issue text. Existing complete financial payload checks,390/402/430px and125% overflow checks preserved. Final CI adds format equivalence and first expansion through Chromium/WebKit; WebKit runs without CDP CPU throttling and is a regression check, not an equivalent timing comparison. Physical iPhone/FaceID/native keyboard/PWA termination remain untested.

## Delivery and next action

Final-SHA CI, fresh main lease and Pages/live-marker confirmation are required before reporting deployment. No backend migration is needed. After this change, measure refresh/reconnect using current SQL functions and fixed CPU/network conditions; avoid repeating this formatter benchmark unless a regression is found. Remaining ALL long tasks should be attributed to DOM/parse/response ordering before any structural optimization; do not suppress the independent total response, hide financial evidence, or introduce stale amount caching.
