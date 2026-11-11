# Build279 — reject incomplete history pages before monthly writes

The deployed worker89 pagedTr skipped a missing/non-array response record collection and could return earlier pages as a completed result. syncHistoryMonth then reached monthly apply and evidence retirement. This is a reproduced code path, not proof that an operational broker response caused historical data loss.

The candidate requires the requested record array on every page and rejects repeated continuation keys. Explicit empty arrays and valid multi-page responses retain existing behavior. An empty array is still not proof of external-flow or position completeness; Build278 remains fail-closed. No ledger normalization, financial arithmetic, historical rows, broker routes or permissions change.

The regression invokes the actual pagedTr and syncHistoryMonth with synthetic network/RPC boundaries. Across ledger, realized and overseas settlement sources, four malformed second-page shapes previously reached write operations (12 cases); after the fix all stop before any RPC write. Valid two-page and explicit-empty responses still work; repeated continuation stops after two requests and writes nothing. Existing foreign-P&L, domestic balance and quantity guards pass.

Initial run baseline: main4a03cfd, workce05b80, frontend275, worker89 ACTIVE; operating worker and NAV/flow functions match source. Main-triggered CI43050583538 and Pages43050581281 passed; actual Pages version/index/sw match. No later normal observation or domestic settlement ledger has arrived. Build278 has no confirmed flow rows, but no post-release normal refresh exists yet, so recurrence after collection is not verified.

Pending: final candidate required CI and deployment. Do not claim this candidate is operational. After CI succeeds, recheck main/work/worker, deploy this worker with the normal existing mechanism, promote the tested commit and verify Pages plus worker bytes. Validate the next normal history collection without forcing broker calls. Whole A/B, source semantics, native cash/FX, ISA opening and actual iPhone remain incomplete. Private operating financial values are excluded.
