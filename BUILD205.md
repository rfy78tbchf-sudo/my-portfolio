# Build205 — Decision journey verification

Verified against main 0b749170f4bff25e16328da23af0fa1ef3152f09 on 2026-10-14.

The targeted local decision suite passed 161 Node test entries across 14 files. It covers comparison assumption invalidation, exact AI linkage, integer-share comparison, saved-form editing, manual versus automatic checkpoints, lost write receipt recovery, account isolation, next-visit reload and review acknowledgements. These are synthetic automated checks, not a physical-device session.

Executed the existing tests/build59f_decision_save.sql fixture against production functions. Its isolated synthetic owner exercises authenticated save/readback, idempotent retry, stored integer-share comparison and rejection of stale comparison assumptions. All assertions passed and the transaction rolled back. No synthetic decision remains in the user's account. Owner-scoped aggregate verification found no missing referenced AI analysis among existing decisions; private counts, content and identifiers are omitted here.

Found a regression coverage gap: the mobile workflow did not run the newer receipt and next-visit review suites. Added a separate Node-only decision-regression job with seven existing suites. It runs independently of browser installation so browser setup failure cannot prevent these checks from running. Runtime UI, database schema and calculations are unchanged.

Scope limits: a new live model generation and a real iPhone end-to-end save/reopen session were not performed in this pass. Existing AI links and production database behavior do not prove fresh model output or physical-device behavior. Roadmap 4/5 are partially verified, not declared fully complete. Financial-source gaps from Build204 remain separate.
