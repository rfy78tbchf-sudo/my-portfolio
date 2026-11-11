# Stored-source amount reconciliation audit — 2026-10-31

Baseline: main9337823a2c2f0cedf61489f6cb31ba90b1a8d44d, existing work branch19776f6fe4c508fdc48e469326780b539b273433. Required branch CI41164156264, main CI41164758106 and Pages41164757827 are successful. Live version.json and service-worker cache markers independently returned Build242. No implementation or deployment change is justified by this audit.

Read-only investigation used the unique active live KB owner constraint, authenticated role and account ownership joins. RPC status grouping selected current-month source-review items, and only those transactions and matching official reports were examined. Outputs were boolean checks and field names, not account IDs, quantities, prices, balances or raw financial rows. No credentials or external authenticated broker calls were used.

## Findings that narrow the remaining work

A stored domestic source-review case has positive quantity/price/gross and exact gross=quantity*price. Its raw cash can be reconciled using the existing period-code component equation (gross minus aggregate charge, arrears fee and other-loan repayment). Subtracting the additional receivable-repayment field as another independent deduction breaks that equality. Therefore do not add every nonzero repayment field to the deduction formula: some fields may overlap. Blank tax-component fields also mean that the independent component-sum test did not establish a tax breakdown. The amount guard must not be bypassed by inventing a residual fee.

A matching SSQM2442 report exists with matching account/security/quantity/gross/effective trade day. It passes source/API/currency/side/date/symbol checks, positive cost, nonnegative fee/tax, price/quantity consistency and daily uniqueness. It fails the independent sell-minus-buy-minus-fee-minus-tax equals reported-profit requirement. Stored cost, fee, tax and profit match their original source fields, ruling out a simple normalization alteration for these fields. Rounding/truncating the displayed component equation and substituting the displayed buy unit price do not reproduce the reported profit. A small nonzero residual alone is not proof of a rounding rule. Private values and counts are intentionally not stored here.

Official public specification freshly retrieved from https://openapi.kbsec.com/api/kbs/guide/excel/b2c identifies SWQA2301 arrs_fee as arrears fee, rcvbl_rpay_amt as receivable repayment and etc_lndng_amt_rpay_amt as other-loan repayment. Its SSQM2442 definitions identify s_amt/b_amt/fee/svrl_tx/rlztn_pl, but do not state allocation precision, rounding/truncation order or overlapping repayment semantics. No undocumented tolerance was introduced.

## Decision and next useful evidence

Keep source_review. Do not promote the broker-reported profit merely because the mismatch is small; do not subtract overlapping repayment fields or change an operating ledger row. This case is an independently inconsistent source-components report, not an API fetch failure, missing sale quantity or duplicate official row.

Needed original evidence: the broker's per-sale acquisition-cost allocation and fee/tax rounding rules, or a detailed settlement/realized-cost statement that independently explains the component difference and any overlap of repayments. Existing stored summaries did not establish that rule. Automatic collection of a more detailed source is not confirmed; SPQM2103 authentication remains subject to the previously recorded approval rejection and must not be retried indirectly.

Next independent work should inspect whether other unknown-order groups have complete, provably order-independent closed-cycle evidence under the existing rules. Exclude already computed cycles and do not reconstruct chronology from ledger sequence or current holdings. If no new independent evidence exists, leave the calculation unchanged instead of repeating this audit. Continue the existing work/performance-detail-render-234 branch.
