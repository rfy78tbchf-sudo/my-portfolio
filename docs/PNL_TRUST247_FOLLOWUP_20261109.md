# P&L follow-up — 2026-11-09

Baseline: main 7f1e05d708a6723863a48d510a17e183f5fd2702; existing work branch cd1217b9bd9aa3549ac5ed0abea0fe14665589a1. Latest required CI and Pages succeeded. Live frontend245 remains intentional; no application redeployment.

New normal collection supplied domestic settlement ledger data. Read-only owner-scoped verification found the newly settled sale displayed exactly once with net proceeds, fees and taxes equal to its ledger row. Original gross minus fee and tax reconciles to net cash within the existing tolerance. Latest average observations retain valid FX equal to their source holdings. Estimate costs_final, pre-sale basis dates and arithmetic checks pass.

Recent-week coverage is no longer identical to the prior audit: a newly collected sale remains direct_mixed_day / same_day_buy_sell_execution_order. Neither archived position observations nor daily snapshots provide a positive pre-sale average for that security; no active position-execution evidence matches it. The existing monthly closed-cycle result also does not cover it. This is not evidence of a fee duplication or an FX capture regression. Missing order_at is not filled by subtracting trading days; the displayed effective date must retain its existing evidence classification.

Required evidence: broker fill timestamps/order and confirmed execution date, an independently reconciled official per-sale cost report, or a genuine dated pre-sale acquisition-cost observation. Current/post-sale averages and ledger sequence cannot establish those facts.

Collection review: existing SWQA2301 settlement ingestion can provide amounts/charges but not proven intraday execution order. SSQM2442 official reports and SPQM2205/2207 source inspection already exist; no duplicate collector is justified. The latest official-report revision has not advanced with this settlement batch. Additional broker-authenticated source retrieval remains subject to the recorded authorization rejection; do not retry it indirectly. Automatic acquisition of historical allocation detail is still unverified.

No calculation or collection change was justified. Next: match subsequent official-source revisions to this settlement, validate date/cost/fee/tax reconciliation and precedence, then retry historical coverage only with genuine new basis/FX or execution-order evidence. Keep the existing work branch; no UI/wealth changes or invented backfill.
