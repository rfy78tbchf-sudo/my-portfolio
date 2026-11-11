# Build271 — originating observation for position evidence

Fresh main f35997c, worker v85, main CI and Pages were checked. Position evidence currently uses insertion time rather than its source snapshot. A delayed older response can therefore win a latest-evidence query. Synthetic actual old SQL: newer quantity 2 followed by older quantity 1 selects 1. Candidate selects 2, preserves earlier fractional 0.5 and creates no duplicate on identical retry.

Add nullable source_observation_id for new evidence only. The service-only writer resolves exactly one owned snapshot through the same request timestamp/successful log binding as cash, uses its observation timestamp, and rejects missing/ambiguous binding, duplicate symbols, invalid quantities and conflicting retries. Existing evidence is not backfilled or rewritten. The worker passes the original request timestamp. Old RPC remains for compatibility.

This does not prove a complete response batch, reconstruct historical cash/FX, or complete whole-account A/B. Empty batches still have no position rows; full-batch metadata and consumer policy remain follow-up work. Existing settlement bridge conservatively retains valuation_time_verified=false. Foreign missing-field normalization is not repaired by this change. No broker call or financial ledger rewrite is part of validation.

Synthetic tests run actual SQL and fixed literal expectations for reordered arrival, fractional quantity, retry count, wrong owner, missing request and invalid/conflicting rows. Full exact-commit CI, operating function/source verification and Pages are required before declaring deployment. Physical iPhone is unverified.
