# Build204 — Include official-only domestic trades in period coverage

Database migration include_official_only_period_candidates deployed 2026-10-14. Frontend remains Build203.

A broker official domestic trade can arrive before cash-ledger settlement. Previously, the period universe was derived from holdings, cash-ledger flows and dividends, so an official-only sold position could disappear entirely while complete=true was reported for the remaining universe.

Added owner-scoped, date-bounded official-only candidates from API SSQM2442 evidence. Require positive quantity, recognized buy/sell side, matching broker trade date, KRW security, and absence from existing rows including normalized aliases. Deduplicate by asset key. Include missing positions with null local/KRW P&L and an explicit ledger-link reason, so coverage remains incomplete. Existing amounts and calculation components are unchanged. Do not equate broker lifetime realized P&L with period P&L without verified opening valuation and trade coverage.

Synthetic SQL test passed: existing A-prefixed alias not duplicated, duplicate official events yield one row, other-account/future/old/manual/mismatched-date records excluded, known aggregate unchanged. Executed the full changed query read-only under the authorized authenticated owner before migration. After deployment the actual RPC included the missing domestic position once, returned 12/13 coverage and complete=false, with zero arithmetic difference. Production function remains invoker with existing statement timeout/settings and privileges unchanged.

Live follow-up confirmed remaining foreign realized P&L gaps are mixed-day execution-order/remaining-cost ambiguity and an unposted settlement, not this display-universe defect. Dates and private account data are omitted from public records. No fabricated cost, execution sequence or transaction was introduced. Roadmap 3 remains incomplete pending these source gaps and independent broker reconciliation. Build203 comparison UX remains unchanged.

## Verification follow-up — 2026-10-14

Mobile workflow 38514742196 and Pages workflow 38514741813 succeeded for implementation commit 500482e. Owner-scoped read-only production RPC verification confirmed that the item sum equals the reported period total, the component reconciliation difference is zero, and normalized symbols are unique. The official-only position remains explicitly uncalculated, so coverage correctly remains incomplete.

Each calculated domestic broker-official realized item matched its persisted source amount and sell proceeds minus buy cost, fees and taxes. Closed-cycle realized items were counted once, excluding their covered raw-item aliases. Remaining foreign gaps distinguish execution-order/cost uncertainty from settlement-ledger delay. An aggregate check found no stored official foreign realized records for the unresolved symbols in the inspected source window; this does not imply that external broker records cannot exist.

These checks verify internal consistency and persisted source reconciliation, not independent reconciliation against the broker app or a complete account return. No estimated cost, financial amount, account identifier or holding detail is added to this public follow-up. Roadmap 3 remains incomplete. Physical iPhone Face ID/resume and real-device latency also remain unverified. No runtime changes were needed for this follow-up.

## Fresh broker source follow-up — 2026-10-14

Used the deployed worker's existing authenticated internal path with an explicit authorized owner to inspect current-month broker sources, without exposing credentials or invoking order endpoints. SWQA2301 and SPQM2205 returned complete paginated responses. SPQM2207 returned an empty period realized response for this request. The settlement source fields do not supply intraday execution timestamp/sequence sufficient to resolve the mixed-day cost ambiguity. This is an observed API response, not a claim that the broker app lacks those records.

Ran the existing idempotent current-month history synchronization successfully, then reread both period and realized RPCs as the authorized authenticated owner. No additional order-date links or retired evidence revisions resulted. The calculated/unresolved coverage remained unchanged; period arithmetic difference remained zero and official-only coverage remained explicitly incomplete. Existing source gaps cannot safely be filled using settlement display order as execution order. The next independent reconciliation needs broker realized-P&L evidence or execution sequence/cost evidence for the affected positions. No runtime code or schema change was made during this source follow-up.
