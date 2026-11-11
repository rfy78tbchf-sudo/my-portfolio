# P&L source audit — 2026-10-31

Main remains 0768c30bfb076fccd702b377e853f5dd5b34120b (Build241). Main CI 41157473071 and Pages 41157472430 now both completed successfully. The existing work branch was 1fdd83b8778531d92ee661f6483ea45cba94d44e, with no competing run or uncommitted change. Live version.json independently returned Build241. No app, calculation, database or deployment changes in this audit.

## New evidence and correction to the previous handoff

Fresh official workbook: https://openapi.kbsec.com/api/kbs/guide/excel/b2c . Download SHA256 c0211b55addc7a38a9f6d7738ff7972e7913cb451fb23bcad7e1a17fccb670da. SPQM2103 sheet agrees with the previously downloaded specification.

The previous handoff listed dl_clsf_nm among useful fields without establishing its meaning. Do **not** interpret it as buy/sell: the official description calls it transaction classification and describes ordinary/fractional trading. The separate ordr_clsf_nm is order classification, but the specification supplies no buy/sell enum mapping. Both need validation against a trusted settlement source. No production mapping was changed.

SPQM2103 has an order number/original order number, ordered/filled/cancelled quantities, average-or-fill price with undocumented aggregation semantics, correction/cancellation classification, order time and execution time. There is no documented per-fill identifier, timezone, date rollover rule, first/last execution-time meaning or guarantee that each response row is one individual fill. A timestamp label alone does not resolve those gaps.

Read-only production check was constrained to the sole active live KB owner and recent overseas buy/sell ledger records. It returned only boolean field-availability indicators. The records exist, but ccls_ttm and ordr_no are absent from their stored source payloads. This confirms that this particular chronology cannot simply be recovered from those existing ledger fields. No private rows, quantities, identifiers or amounts were exported or committed. Other sources were not exhaustively excluded by this check.

## Reproducible ambiguity, not an assertion about the broker

Run `node docs/research/order-time-ambiguity.mjs` (Node24.22.1; passed). The entirely synthetic example assumes, for illustration only, that execution time means last fill. Two possible fill histories have identical order summaries, prices, total quantities, order timestamps, last-fill timestamps and closing quantity, yet moving-average realized P&L is 66.66666666666666 versus 75 synthetic currency units. The opening lot is also identical. Therefore even that plausible timestamp interpretation is insufficient without fill completeness/aggregation proof. This script is an evidence counterexample, not the app's calculation implementation or a claim about actual broker trades.

## Next bounded implementation

Continue work/performance-detail-render-234. Build an authenticated, date-and-symbol scoped **read-only** SPQM2103 diagnostic with a strict field allowlist, no finance writes and no automatic chronology promotion. Check calendar-valid dates, full pagination, repeated cursor/duplicate rows, provider errors and truncated results. Current pagedTr stops at its page cap but does not reject repeated cursors early; the diagnostic must not interpret a repeated/partial page set as complete evidence. Keep the shared collector unchanged until separately reproduced and tested.

Return coverage/ambiguity explicitly, including absent side mapping, blank/tied time, correction/cancellation, fractional trade and cross-midnight cases. A successful API response is not sufficient to assert execution order. First reconcile totals and side against trusted settlement records; then require documented individual fill identity/time semantics or a proven order-independent allocation. Actual authenticated SPQM2103 availability and historical coverage have **not yet been tested**. The existing deployed worker has no SPQM2103 diagnostic action, so this run did not invoke it or fetch credentials.

If this source is aggregate-only, the needed original is a per-fill execution statement with date/time/timezone, side, unique fill identity, quantity and price (plus independently reconciled fees/taxes), or an official matching realized-cost statement with compatible currency/fee definitions. Automatic retrieval remains a candidate, not a confirmed solution. Preserve unknown-order, missing-cost, amount/source-review, settlement, FX and fetch-failure distinctions.
