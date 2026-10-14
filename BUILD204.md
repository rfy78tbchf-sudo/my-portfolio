# Build204 — Include official-only domestic trades in period coverage

Database migration include_official_only_period_candidates deployed 2026-10-14. Frontend remains Build203.

A broker official domestic trade can arrive before cash-ledger settlement. Previously, the period universe was derived from holdings, cash-ledger flows and dividends, so an official-only sold position could disappear entirely while complete=true was reported for the remaining universe.

Added owner-scoped, date-bounded official-only candidates from API SSQM2442 evidence. Require positive quantity, recognized buy/sell side, matching broker trade date, KRW security, and absence from existing rows including normalized aliases. Deduplicate by asset key. Include missing positions with null local/KRW P&L and an explicit ledger-link reason, so coverage remains incomplete. Existing amounts and calculation components are unchanged. Do not equate broker lifetime realized P&L with period P&L without verified opening valuation and trade coverage.

Synthetic SQL test passed: existing A-prefixed alias not duplicated, duplicate official events yield one row, other-account/future/old/manual/mismatched-date records excluded, known aggregate unchanged. Executed the full changed query read-only under the authorized authenticated owner before migration. After deployment the actual RPC included the missing domestic position once, returned 12/13 coverage and complete=false, with zero arithmetic difference. Production function remains invoker with existing statement timeout/settings and privileges unchanged.

Live follow-up confirmed remaining foreign realized P&L gaps are mixed-day execution-order/remaining-cost ambiguity and an unposted settlement, not this display-universe defect. Dates and private account data are omitted from public records. No fabricated cost, execution sequence or transaction was introduced. Roadmap 3 remains incomplete pending these source gaps and independent broker reconciliation. Build203 comparison UX remains unchanged.
