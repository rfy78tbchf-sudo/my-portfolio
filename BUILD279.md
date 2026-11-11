# Build279 — reject incomplete history pages before monthly writes

The deployed worker89 pagedTr skipped a missing/non-array response record collection and could return earlier pages as a completed result. syncHistoryMonth then reached monthly apply and evidence retirement. This is a reproduced code path, not proof that an operational broker response caused historical data loss.

The candidate requires the requested record array on every page and rejects repeated continuation keys. Explicit empty arrays and valid multi-page responses retain existing behavior. An empty array is still not proof of external-flow or position completeness; Build278 remains fail-closed. No ledger normalization, financial arithmetic, historical rows, broker routes or permissions change.

The regression invokes the actual pagedTr and syncHistoryMonth with synthetic network/RPC boundaries. Across ledger, realized and overseas settlement sources, four malformed second-page shapes previously reached write operations (12 cases); after the fix all stop before any RPC write. Valid two-page and explicit-empty responses still work; repeated continuation stops after two requests and writes nothing. Existing foreign-P&L, domestic balance and quantity guards pass.

Initial run baseline: main4a03cfd, workce05b80, frontend275, worker89 ACTIVE; operating worker and NAV/flow functions match source. Main-triggered CI43050583538 and Pages43050581281 passed; actual Pages version/index/sw match. No later normal observation or domestic settlement ledger has arrived. Build278 has no confirmed flow rows, but no post-release normal refresh exists yet, so recurrence after collection is not verified.

The candidate has now been deployed; see the receipt below. Validate the next normal history collection without forcing broker calls. Whole A/B, source semantics, native cash/FX, ISA opening and actual iPhone remain incomplete. Private operating financial values are excluded.

## Verified rollout — 2026-11-12

Exact commit 0f6a66f43ce62d29d4f4192b3ade57ac5f90141b passed both required jobs in [CI43060053477](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43060053477), including the new history guard and full existing mobile regression. Rechecked main/work heads and deployed worker89 byte equivalence before replacing the existing function.

Worker90 is ACTIVE, byte-identical to the tested source, with its existing authentication configuration preserved. Main advanced to the tested commit using an expected-SHA lease. [Pages43068318827](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43068318827) succeeded. Frontend remains Build275 intentionally; no frontend files changed.

Read-only before/after comparisons retain identical original transaction, cash-flow, account-observation and daily-account-snapshot row counts and full content hashes. Same-cutoff primary A arithmetic remains unchanged and unverified; whole B/difference remain unavailable. Build278 SQL body hashes remain unchanged and no flow intervals are falsely confirmed. No schema/history mutation, test-data insertion, actual order or manual broker call was made.

Latest normal observation still predates this release. Operational successful history collection under worker90 and recurrence after settlement are NOT yet verified. Actual logged-in iPhone testing was not performed. Continue normal-collection verification, interval completeness/source semantics, domestic settlement, native cash/FX and ISA opening tasks. Do not relabel deployment verification as whole-account reconciliation completion.
