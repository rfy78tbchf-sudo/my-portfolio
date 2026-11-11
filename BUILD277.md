# Worker candidate: reject missing foreign official P&L

An active SPQM2226 holding with absent, blank or invalid `krw_exch_val_pl` passed the balance guard. `normalizeOverseas` then used `n()` to persist unknown official P&L as zero. A synthetic actual-syncCurrent test reproduced seven invalid responses reaching the snapshot writer before this change.

The guard now requires a finite official KRW P&L for rows the normalizer persists. Invalid responses fail before every storage RPC, preserving the prior observation. Explicit zero and signed gains/losses remain valid; zero-quantity/zero-valuation placeholder rows remain ignored. No fee, FX, cost, P&L definition, source timestamp, account scope or normalization formula changes. No extra requests.

The independent synthetic expectations use KRW -130/0/+130 at FX1300 -> USD -0.1/0/+0.1. Seven incomplete responses previously reached storage; now none do. Existing valid foreign fixtures explicitly provide their official P&L instead of relying on an omitted field becoming zero. Domestic response, UUID SQL storage, source preservation and retry/RLS checks pass locally. Required final-commit CI must pass before deployment. Frontend stays Build275 because this is worker-only.

Operating read-only inspection is for compatibility, not evidence that the synthetic failure occurred in the user's history. Whole-account A/B and the pending settlement/source-semantics issues in BUILD276 remain unresolved. Do not claim operational P&L improvement from this guard. Real iPhone is not tested.


## Verified deployment

Final commit `aea8d9aebd087d69648a38f03a77b35b29c002fc` passed both required jobs in [CI43012926897](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43012926897), including Chromium/WebKit mobile and zoom regressions. An additional existing contract fixture was corrected to supply explicit zero P&L; the production guard was not weakened. Main and worker88 were rechecked immediately before deployment. Worker89 is ACTIVE and byte-identical to the final source; main was advanced with an expected-SHA lease. [Pages43015533546](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43015533546) succeeded. Live version.json/index.html/sw.js match the commit; frontend remains Build275 intentionally.

Read-only current foreign holdings had valid official P&L fields before rollout; no observed historical incident is claimed. Same-cutoff three-period A outputs are unchanged before/after rollout. Whole B/difference remain null and whole verification false. Latest financial observation predates worker89, so the next normal successful collection still needs operational confirmation. No manual broker call, financial-history edit or operational test insertion was made. Actual iPhone remains untested. Next continue BUILD276 settlement-ledger/source-semantics and original-currency cash evidence tasks, without repeating this completed guard.
