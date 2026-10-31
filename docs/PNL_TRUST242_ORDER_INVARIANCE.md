# Order-invariant allocation audit — 2026-10-31

Baseline: main9337823a2c2f0cedf61489f6cb31ba90b1a8d44d (Build242), work branch ebd44d2dbe052544b71d3597bf280e7908b86bf5. Main/branch CI and Pages remain successful. No application, calculation or financial-record changes were made.

Owner-scoped read-only queries compared the actual realized-sale RPC with period-P&L results for the screenshot week and current month. Already returned closed_cycles and broker-official replacements were excluded. None of the remaining unknown-order groups was flat at both selected-period boundaries. The unresolved weekly groups still have closing positions; monthly groups that end flat have nonzero opening positions. Therefore net trade cash alone is not an additional bounded-period realized-P&L solution. A valid total period result does not establish the realized/unrealized decomposition.

The replay implementation already resets remaining basis when quantity returns to zero. No missing reset fix was found. Existing closed-period aggregation and duplicate-sale guards remain in place. `node tests/build79_closed_realized.mjs` passed.

A second read-only screen examined issue days for foreign transactions using zero cumulative opening ledger quantity, no earlier non-trade position events, independently reconciled trade cash and identical aggregate buy unit cost. Some rows meet that preliminary screen. This is NOT sufficient proof: ledger rows have no established per-fill granularity or execution-time semantics. Equal aggregate unit cost does not establish equal prices for all hidden partial fills. The scan is a candidate screen only; opening quantity is ledger-derived, not independent proof of complete history.

Executable counterexample: `node docs/research/zero-opening-aggregate-ambiguity.mjs` passed. Both wholly synthetic histories start empty, have one aggregate purchase of ten units at average10 and one sale of five at20, and never short. Hidden buy fills5@8 and5@12 on opposite sides of the sale yield different partial realized profits60 versus40 and remaining costs60 versus40. Aggregate rows and closing quantity match. Once the remaining position is fully sold at the same price, the complete flat-to-flat profit agrees. These are invented test values, unrelated to any user's transactions.

Decision: do not implement the apparent zero-opening/equal-aggregate-cost shortcut. It could falsely turn unknown order into a confirmed amount. Require per-fill identity/time/price evidence, a documented guarantee of uniform individual fill cost, or an independently reconciled official cost statement. Whole-cycle aggregation remains valid only under its existing completeness, boundary, cash, currency and settlement guards.

## Evidence gate for further runs

Do not repeat the same token attempt, one-unit source-component discrepancy audit, or the two synthetic order-ambiguity proofs without changed evidence. The live broker authentication request remains rejected by automatic approval review and must not be retried through another route. Useful triggers are new independently collected source data, documented fill/rounding semantics, explicit additional authentication authorization, a reproducible new correctness failure, or a changed code/deployment state. With unchanged inputs, retain Build242 and avoid unnecessary edits, redeployment and repeated reports. This is not a claim that P&L reliability work is complete.

Private transaction IDs, account references, names, amounts, quantities and per-security results are intentionally excluded. Continue the existing work/performance-detail-render-234 branch.
