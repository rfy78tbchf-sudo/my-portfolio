# Build251 — reconcile domestic opening balances and distinguish partial totals

## Problem and evidence
The home trend shows changes in recorded assets including external flows and account additions. The stock period view covers KB stocks only, excluding ISA and cash. These measures must not be forced to agree. A seven-day flow interval begins on the day after its opening valuation; the preceding date on the home chart is an opening observation, not an extra day of stock transactions.

Read-only investigation reproduced a domestic stock being excluded by the opening-quantity mismatch gate despite a verifiable settlement bridge. The broker execution-date evidence placed its purchase before the period while the prior daily balance had not incorporated settlement. A nearby, synchronized account/security snapshot on a day without trades reconciled the reconstructed quantity. The existing boundary validation was USD-only.

## Change
- Extend that boundary path to KRW only when broker-verified execution dates and validated ledger cash identify pre-period trades settling after the boundary; their entire signed quantity must exactly explain the prior snapshot discrepancy. Require KRW FX=1, synchronized prior snapshots, settlement completed by the nearby confirmation snapshot, the existing no-trade/no-corporate-action checks, and an exact preceding-day historical closing price. Existing USD rules and all amount formulas remain unchanged. No current average cost or later price is backdated.
- When a stock aggregate is incomplete, its primary headline is `전체 손익 미계산`. The existing calculated subtotal remains visible immediately below it with its partial label, excluded names/reasons and provisional flags. A complete zero remains zero; missing totals remain unknown.
- Explain the preceding-day opening basis beside period dates; explicitly mark home asset change as including flows and not investment P&L. No additional requests or caches. Wealth features and period/account/currency definitions remain unchanged.

## Validation
Full-function PGlite regression with synthetic broker evidence: the correct boundary produces the independently expected 150 KRW result. Fourteen rejection cases retain exactly the previous handling: quantity, prior/later timestamps, owner, historical quote date/value, KRW FX, raw cash, absent/ambiguous execution dates, observation-day trades and corporate actions. Seven other periods preserve complete JSON; another owner cannot obtain the test user's positions. Migration applies idempotently and is guarded from a1c5b0dd24c00467912fc425ce351892 to f1a27d7de13ff0c0ad2ef4b7890d04f3.

Read-only production comparison: only the eligible domestic item changes in 1W. Other items, including the unresolved foreign opening mismatch, remain unchanged. Complete JSON remains equal for 1M, 3M and ALL. No customer amounts, quantities, account identifiers or raw payloads are included in this record or test fixtures.

Authenticated SQL regression sampling, jit off/work_mem16MB, three alternating EXPLAIN ANALYZE runs per version; same production dataset, no cache flush. SQL execution only, not network/browser time:

| Period | Before ms | After ms | Median before → after |
|---|---|---|---|
| 1W | 1234.335, 440.473, 424.386 | 462.849, 443.641, 497.702 | 440.473 → 462.849 |
| ALL | 1539.894, 1314.381, 1311.011 | 1332.863, 1308.566, 1415.716 | 1314.381 → 1332.863 |

First control executions were slower; do not infer a speed improvement, cold-start improvement or tail latency from these small samples. Additional correctness checks add modest median cost with overlapping ranges. No independent optimization is included.

Local Chromium synthetic RPC-output tests passed at390/402/430px and100/125% zoom: partial/complete/zero/unknown totals, basis date, scope wording, touch disclosure, returning between home and stock view, amount fit and no horizontal overflow. Existing build210 P&L-state tests and build72 version/update test passed. Full CI adds WebKit and existing financial, mobile, navigation, refresh and wealth regressions. Physical iPhone/PWA/Face ID untested.

## Release gate and handoff
Continue the existing work/performance-detail-render-234 branch, based on9674cb4 with main47efd8e (deployed250). No concurrent application run was active at start. Do not ship the post250 experimental optimization fixtures as production SQL.

Pending: final commit CI, apply the exact tested function migration, recheck main SHA, guarded fast-forward, successful Pages and live251 markers. Do not report deployment until verified.

Remaining correctness gap: a foreign stock's opening quantity still disagrees with the dated daily snapshots. Nearby observations within the existing window contain trades or do not reconcile; do not extend the window until it coincides with current holdings just to make it pass. Required evidence is broker beginning/end-of-session holdings and complete executions around the period boundary, including execution and settlement dates and cancellations/corrections. Existing automatic ledger/position evidence and snapshots were read; those alone did not establish the boundary. Preserve the missing flag. Next action: check whether the existing broker read endpoints can return that historical balance/execution evidence; otherwise state the exact unavailable original record. Continue the recorded performance hypotheses only after correctness regressions remain protected.
