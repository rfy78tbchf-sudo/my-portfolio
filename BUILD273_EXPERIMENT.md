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

## 2026-11-10 source ownership and historical read integration

Fresh main 86aed9879276ffcb847a28878eed356d94a62f0c (Build274), main CI 42817630527 and Pages 42817629079 were successful; actual version/index/sw matched. Worker remains v86. No competing active run/branch mutation was observed.

Added experiments/evidence_batch_273_access.sql to this existing prototype, not a new product API. It binds a batch to exactly one account_observations row using the original request timestamp and successful sync log, derives account/observation time from that source, denies public/authenticated writes, and applies owner-only RLS to invoker reads. Added dated reads so later observations cannot leak into historical opening quantities. Internal table references are schema-qualified for the definer wrapper's empty search_path.

node tests/build273_batch_access.mjs passes with literal synthetic expectations: matching source succeeds; wrong owner, missing, failed and ambiguous source reject; identical late retry does not revive sold positions; conflicting retry rejects; authenticated direct writes/base writer/wrapper and anonymous reads reject; another user's direct table/read returns no evidence; historical first response retains quantity 2, later complete-empty returns [], and a cutoff before all evidence returns null. Existing build273_evidence_batch tests still pass. This is PGlite role/RLS verification, not hosted JWT/PostgREST testing.

Operating live_position_settlement_basis still selects latest evidence per account/symbol, not one response batch. Next concrete integration: replace that selection with a batch-at-cutoff envelope and adapt its consumers to inspect completeness before expanding rows. Incomplete empty must yield unknown, complete empty must close the lifecycle, and legacy records must remain explicitly unverified. Do not merely swap a per-symbol view: callers could otherwise fall back to older rows or turn empty into zero. Source adapter field-presence/completeness, UUID/FK production schema and all seven SQL readers still need integration before deployment. The local wrapper's completeness argument remains synthetic/trusted-test input, not verified broker completeness.

No product/schema/worker changes deployed in this continuation. Overall whole-account A/B remains incomplete; actual values are kept in the private run record. Current operating product is Build274 / worker86. No new browser or actual iPhone test was necessary for this non-deployed SQL prototype. Keep the existing task enabled.

## 2026-11-10 actual settlement consumer integration candidate

Fresh main remains Build274 SHA86aed9879276ffcb847a28878eed356d94a62f0c. Main CI42817630527 and Pages42817629079 succeeded; current version/index/sw bytes matched and operating worker86 was re-read. Operating settlement function still selects per-symbol evidence. No other active run or branch movement was observed.

Added experiments/batch_settlement_bridge_273.sql, based on the actual Build266 domestic settlement matching SQL, with response-at-NAV-cutoff selection before expanding positions. Only a complete response at the exact NAV cutoff can provide positions. Unknown/missing/partial/stale data cannot fall back to older symbol rows. Empty positions are explicitly distinguished but do NOT prove zero unsettled cash. The response envelope participates in data_version, including empty/partial responses, to invalidate corrected evidence. It remains a local-only function with a separate name.

node tests/build273_batch_settlement.mjs passes: independently expected aligned payable -1010 and remaining gap0; corrected cash -1011 leaves gap1; duplicate official evidence and missing original cash stay null; a future response is excluded; stale/partial/null quantities stay unknown; complete empty stops the obsolete match. In the same synthetic empty-response scenario the existing per-symbol function still returned -1010, whereas candidate pending_settlement_net is null. This is a synthetic correctness result, not an operating loss/profit improvement. Cross-account selection stays empty. Existing batch access and lifecycle/type tests pass.

No deployment: this integrates ONE consumer locally. The worker adapter still needs trustworthy original-field presence and response completeness, production UUID/FK schema is pending, and the remaining period/cycle/timeline/reconciliation readers plus live_position_settlement_basis must be moved together. Do not declare completeness solely because the synthetic complete flag is true. Do not change old observations or replace unknown cash with0. Next: port the period opening-balance check to batch-at-cutoff with the same incomplete/empty rules, then carry those semantics into the other consumers. Full A/B remains incomplete; actual operating observations are recorded privately. Build274/worker86 unchanged; no new browser or real iPhone validation. Keep the existing task enabled.

## 2026-11-11 opening quantity consumer integration candidate

Fresh main remains 86aed9879276ffcb847a28878eed356d94a62f0c / Build274. Main CI42817630527 and Pages42817629079 are successful and no active run appears in recent runs. Actual version/index/sw bytes match main. Re-read worker86 source matches repository; operating get_live_period_stock_pnl(text) body matches build260_closed_opening_quantity.sql. The existing batch branch was bd4dfb6 before this continuation; no competing movement observed.

Added experiments/batch-opening-candidate273.mjs: a drift-checked transformation of the actual period function's native_opening_balance_checks. It selects one account response BEFORE expanding rows, bounded by the lesser of the request cutoff and the exclusive next New York premarket boundary. Complete-empty, incomplete, absent, null-quantity or currency-mismatched responses cannot use older per-symbol evidence. Existing source identity, pending execution, quantity equality, currency, corporate-action and NY DST/lower-window checks remain. No current observation is backdated into an opening balance.

node tests/build273_batch_opening.mjs passes. The full transformed SQL compiles and returns exactly baseline outputs across nine periods for the existing synthetic fixture. The exact extracted opening CTE additionally has independent literal expectations: a complete aligned response verifies one asset; no batch/partial/empty/null/wrong currency verify zero, while the old function still verifies one from the obsolete legacy row after empty. Future and exact-next-premarket responses cannot erase a historical opening; reacquisition can restore valid evidence; duplicate official occurrences and wrong user block verification. Winter and summer DST lower/upper boundary expectations use fixed UTC times. This is SQL verification, not an end-to-end operating P&L proof. Existing access, batch lifecycle and settlement candidate tests also pass.

No production migration, worker edit or UI deployment in this continuation. Synthetic completeness remains a test assumption. Operating whole-account reconciliation remains unverified; financial values are not included here. No browser/iPhone or speed claim for this local-only change.

Next concrete integration: adapt get_live_realized_cycle_review's position evidence selection to dated batches, exercise full-sale/rebuy boundaries with independent quantities, and ensure missing/empty batches cannot resurrect historical ownership. After remaining readers/view are integrated, implement the trustworthy original-field/completeness adapter and production UUID/FK schema as one verified rollout. Do not deploy an isolated reader that depends on an unpopulated batch table. Build274/worker86 stays operating; whole A/B completion remains outstanding; keep existing recurring work enabled.

## 2026-11-11 lifecycle review consumer integration

Fresh main remains 86aed9879276ffcb847a28878eed356d94a62f0c / Build274. Main CI42817630527 and Pages42817629079 successful, no active recent runs; actual version/index/sw match main. Worker86 source equals repository. Operating get_live_realized_cycle_review(text) body equals build54e_lifecycle_review.sql. Existing batch branch started at5acb5f5, without competing movement.

Added drift-checked experiments/batch-cycle-candidate273.mjs and full-function PGlite test tests/build273_batch_cycle.mjs. Reproduced the old function accepting any earlier zero row plus a zero row on the final sale date BEFORE that sale as closed_cycle_verified. The candidate selects one latest complete account envelope before the first trade date and requires it to be from the immediately preceding KST day. Ending evidence must be after the final trade DAY, because the existing ledger bounds are date-only and cannot prove intraday ordering. This deliberately leaves same-day closure unverified rather than inventing execution precision.

The entire account completeness assumption is essential: an absent symbol in a verified complete account response can prove zero holdings; an incomplete/page/currency subset cannot. Tests use that assumption explicitly; no production adapter currently certifies it. Explicit rows also require correct currency/source and non-null quantity components with consistent arithmetic. Missing/partial/null/wrong-currency observations do not resurrect old zeros, and subsequent positive holdings invalidate ending-zero evidence. Future responses are excluded.

Independent synthetic numbers: buy2 for200, sell2 for220 => cash difference20 USD remains20. Baseline falsely marks closed_cycle_verified from stale/pre-sale zeros; candidate marks opening_or_ending_balance_unverified. Complete opening/ending empty responses restore verified status; reacquired quantity1, partial, null, wrong currency remove it; explicit valid zero restores it. Later partial opening evidence invalidates the earlier zero. Wrong user returns no owner trades, missing auth raises. Existing opening, settlement, access, lifecycle/type tests all pass (five test scripts total). These are local SQL tests, not an operating A/B reconciliation, performance, browser or iPhone result.

No deployment. Today still lacks closing NAV after the KST date rollover; week/month remain whole-account unverified. No private financial values committed. Remaining adapters/readers, production schema, cache/version integration and hosted security regression must be completed before rollout. Next: timeline and service reconciliation consumers must select batch envelopes before filtering symbols, preserve explicit unknown status on empty/partial data, and stop timeline readers from presenting legacy normalized-zero fields as verified source evidence. Continue with their actual SQL and independent fixtures; do not replay the same completed tests alone. Build274/worker86 remains operating, full A/B incomplete, existing task remains enabled.
