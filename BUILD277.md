# Worker candidate: reject missing foreign official P&L

An active SPQM2226 holding with absent, blank or invalid `krw_exch_val_pl` passed the balance guard. `normalizeOverseas` then used `n()` to persist unknown official P&L as zero. A synthetic actual-syncCurrent test reproduced seven invalid responses reaching the snapshot writer before this change.

The guard now requires a finite official KRW P&L for rows the normalizer persists. Invalid responses fail before every storage RPC, preserving the prior observation. Explicit zero and signed gains/losses remain valid; zero-quantity/zero-valuation placeholder rows remain ignored. No fee, FX, cost, P&L definition, source timestamp, account scope or normalization formula changes. No extra requests.

The independent synthetic expectations use KRW -130/0/+130 at FX1300 -> USD -0.1/0/+0.1. Seven incomplete responses previously reached storage; now none do. Existing valid foreign fixtures explicitly provide their official P&L instead of relying on an omitted field becoming zero. Domestic response, UUID SQL storage, source preservation and retry/RLS checks pass locally. Required final-commit CI must pass before deployment. Frontend stays Build275 because this is worker-only.

Operating read-only inspection is for compatibility, not evidence that the synthetic failure occurred in the user's history. Whole-account A/B and the pending settlement/source-semantics issues in BUILD276 remain unresolved. Do not claim operational P&L improvement from this guard. Real iPhone is not tested.
