# Build211 — Finish an interrupted judgment save without a duplicate

Baseline: Build210, main `ff9e4b451399d8c66283c828783865eec844c310`.

Build marker: `2026-10-19-decision-recovery-211`.
Service worker cache: `my-portfolio-shell-2026101903-211`.

## Problem reproduced

The detail screen recognizes an already-saved local draft by its request ID. The deployed `get_investment_decisions(uuid)` function did not return `request_id`, although the frontend expected it. Existing tests gave the frontend full table rows and concealed this API projection mismatch.

With the real projection, a judgment whose write committed but whose response and receipt lookup were lost reappeared as an unfinished draft on the next visit. When the next visit's history read also failed, an analysis-linked decision could be submitted with a new request ID and no analysis link. A comparison-linked decision instead became blocked because its restored inputs were treated as an uncalculated new comparison. These failures were reproduced with production handlers and isolated browser routes.

## Frontend changes

- Retain the exact submitted arguments, submitted field values and owner-specific draft key before the first asynchronous save. This also covers an unchanged prefilled form with no input event.
- When the user explicitly retries an unchanged pending judgment, reuse its original request ID, analysis ID, comparison target, price assumptions and observation time. A page reload does not turn missing in-memory analysis or comparison state into a different submission. Opening the app never automatically replays a write.
- The bottom next-action button also offers **이전 판단 저장 재시도** for a valid restored submission and invokes the same validated form submission. Busy state takes precedence; edited inputs or newly confirmed evidence return to the existing comparison/analysis checks. The final browser test uses this actual bottom action rather than only the inline submit button.
- Compare trimmed text and equivalent numeric input when identifying a retry. Formatting-only edits do not create a second judgment or leave another unfinished draft after confirmation.
- Allow a genuinely edited judgment, or a comparison/analysis explicitly refreshed with new evidence, to pass the normal current-input checks and receive a new request ID. A rejected stale comparison does not trap the user in the old request.
- A successful write must be reread with matching security, request, choice, reason, review condition, analysis and saved comparison before completion. The same checks recognize an interrupted submission in later history responses.
- A confirmed original submission clears only its own matching input. A later edited reason, review condition or comparison remains a draft. Existing v1 request tuples, including a zero target, are supported.
- In a returning draft, describe an unconfirmed result as unconfirmed. If device storage fails, distinguish the input retained in the current screen from input saved on the device. Prefer the current session's latest in-memory draft over an older disk copy after a failed write.
- Ignore both success and failure from a history request superseded by a newer request or verified save. Do not start competing history reads during a save. Restore a still-visible retry button after an obsolete request finishes, including when the overlapping save also fails.

No new analysis feature, navigation menu or home performance control is added.

## Database change

`supabase/build211_decision_request_readback.sql` adds `request_id` to the existing history projection. The existing fields, owner and security filters, latest-ten limit, invoker behavior, empty search path, and execution privileges remain the same.

The migration was applied to the app's Supabase project. Introspection before and after confirmed that removing the added `,d.request_id` from the deployed function produces the exact previous function definition. Anonymous execution remains disallowed and authenticated execution remains allowed. The security-advisor comparison found no new findings from this change.

## Database verification

- `tests/build211_decision_request_readback.sql` passed against the deployed getter using two isolated synthetic owners and two securities. It checks request identity, reason, review condition and comparison JSON, including the same request UUID belonging to different owners. Both owner and security boundaries are asserted under the authenticated role.
- The existing `tests/build59f_decision_save.sql` passed against the deployed save and comparison functions. It checks authenticated comparison save, saved integer-share assumptions, an idempotent retry returning the same judgment, and rejection of changed comparison inputs.
- Both SQL fixtures run in one transaction and end with `ROLLBACK`. The test owners, accounts, securities, analysis records and judgments are not retained.

## Focused regression coverage

- `tests/build211_pending_decision.mjs`: 35 production-handler regressions, including lost write responses, a new page/runtime, full comparison and analysis identity, edited follow-up drafts, format-only input, newly confirmed evidence, invalid or cross-owner/cross-security pending requests, legacy drafts and storage failure.
- `tests/build211_review_race.mjs`: 8 controlled response-order regressions for old history/analysis success and failure, manual retry, save overlap and a retry button remaining usable after both requests fail.
- `tests/decision_edit_prefill.mjs`: 53 existing and added edit/draft regressions now use the actual getter SQL projection. Testing with the old projection reproduces the missing-request failures instead of hiding them behind full table-row mocks.
- `tests/build157_decision_receipt.mjs` continues testing exact lost-receipt recovery and account changes, and executes the production full-content matcher. `tests/comparison_target_clear.mjs` retains the comparison-detachment checks with the current submit closure and request identity.
- `tests/build211_decision_browser.mjs` drives the real startup, auth-fetch, RPC queue, form, receipt verification and renderer using isolated network routes. It covers manual save, an integer-share comparison with a stored synthetic opinion, response/receipt loss followed by a new visit, and response loss plus failed history followed by an explicit original-request retry. All external and model requests are blocked.

The mobile CI workflow includes both new handler suites and the browser journey.

## Local integration verification

- The decision-regression command passed all 16 test files covering existing readback, review consistency, daily access, scope retention and the Build211 handlers. The next-action routing tests also passed after the restored-save footer connection was added.
- `tests/build67_ui_visual.mjs` passed its Chromium run at 390/402/430 pixels, including five main screens, 125% text, chart touch, input and navigation checks. Its separate WebKit navigation run also passed.
- `tests/build209_daily_browser.mjs` passed in Chromium and WebKit with the real stored-session startup and data-loading paths. The synthetic journey checks three core screens, delayed resume, draft input, period/filter/scroll preservation and page reload.
- The final `tests/build211_decision_browser.mjs` run passed in both Chromium and WebKit at 390 pixels. Its restored-comparison case checked the bottom **이전 판단 저장 재시도** button, clicked it and verified the entire original payload and request ID. Five explicit save POSTs across the journey produced exactly four saved synthetic judgments. Reopening created no additional write. The final WebKit draft, confirmed-save and new-visit screens were visually checked.

These are browser simulations. Their synthetic delays do not measure the app's real account or iPhone latency.

## Scope limits

The browser route server uses synthetic data and does not execute production SQL. The SQL fixtures separately verify the deployed database boundary. Neither establishes Face ID behavior, physical iPhone home-screen relaunch, native keyboard placement or live account latency. No real user judgment or fresh AI response was created. Remaining financial-source completeness gaps are outside this release's change to judgment-save continuity.
