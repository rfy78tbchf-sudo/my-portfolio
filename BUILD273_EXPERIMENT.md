# Build273 — response-batch selection experiment

Fresh main f506ef99a42bc1993eca6c82852149c94431235c / worker v86 / successful main CI 42790541830 and Pages 42790541490 checked on 2026-11-10. Live version.json/index.html/sw.js matched the main files. No active CI or conflicting product change was observed. Build272's rejected reject-all/exclude-foreign candidates were not repeated.

Implemented a local-only SQL candidate and fixed-expectation PGlite tests:
node tests/build273_evidence_batch.mjs

The selector chooses one account response before expanding symbols. Tests passed for complete empty after holding 2; delayed old retry; reacquisition .5; unknown effective quantity remaining null; incomplete empty distinguished from complete empty; explicit zero; same symbol in KRW/USD; account isolation; identical retry; conflicting retry; duplicate identity; ambiguous equal observation time. Row counts and quantities are literal independent expectations.

This is NOT a production migration. It demonstrates the selection contract but does not establish authentic broker completeness. Do not deploy it as-is: service authorization/RLS, source observation ownership, trusted adapter validation, source precision and all consumers must be integrated and verified first. It returns observations, not investment returns. A complete batch can still contain a field-level unknown; downstream calculations must preserve null.

Fresh operating dependencies that directly read kb_balance_position_evidence:
- get_live_period_stock_pnl
- get_live_realized_cycle_review
- get_live_settlement_bridge
- get_reconciliation_case_timeline
- refresh_reconciliation_cases_for_service
- save_kb_balance_position_evidence_for_service
- save_kb_positions_for_response_for_service
Also audit the live_position_settlement_basis view and its consumers.

No linked v86 batch had arrived at this check. The account_observations schema contains normalized amounts and source IDs, not the original field-presence payload; do not infer legacy field validity from normalized zeros. No broker calls, production data writes, schema changes, product deployment or new browser/iPhone validation were performed. Today/week/month remain whole A/B incomplete. No speed claim.

Next implementation: adapt save_kb_positions_for_response_for_service to write an immutable batch envelope tied to its verified source_observation_id; map per-field presence to nullable typed evidence; migrate the seven consumers and settlement view together. Make an incomplete latest batch return unknown, never older per-symbol evidence or automatic zero. Preserve legacy records; do not backfill alleged completeness. Add production-function tests for historical lifecycle closure and period opening quantity before CI/deployment. The prototype is useful only as the selection contract, not evidence that these integrations are finished.

Overall task remains incomplete; keep the existing recurring task enabled. Product stays Build271 / worker86 / UI266.


## 2026-11-10 continuation while Build274 CI runs

Added typed quantity validation to this same local-only prototype. Seven invalid JSON types/values (empty/numeric/NaN/Infinity strings, boolean, array, object) plus a negative fraction previously entered the candidate table (8/8); now 0/8 enter. All four quantity fields reject negatives. Missing and explicit null remain unknown, explicit zero and 0.125 remain unchanged. Existing lifecycle/retry/account/currency tests pass. No production SQL or worker changed. Service authorization/source ownership and all consumers remain the next integration requirement; this additional guard does not establish broker response completeness.
