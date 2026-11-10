# Build269 deployment handoff — 2026-11-10

Product commit: `89e97ef6cdb0891d1d3240d192c39b31ca2cad84`.
Fresh main lease was `7a257e33cba369a383f59e615b175b1f80cabb90`; integration was fast-forward.
Required exact-commit CI [42769218905](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42769218905) succeeded before promotion.
Pages [42771019177](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/42771019177) succeeded on the same product SHA.
The main-triggered duplicate CI started afterward; the exact product commit already passed the required branch CI.

Applied migration `bind_cash_to_snapshot_response_269`; read-back function body matches candidate and EXECUTE is denied to anon/authenticated, allowed to service_role.
Deployed kb-sync-worker v84, ACTIVE; fetched source exactly matches tested code. Existing custom authorization preserved.
Operational OPTIONS returned 204 and unauthenticated POST returned 401. No authorized broker refresh was invoked as a test.
Actual Pages version.json/index.html/sw.js returned 200 with bytes equal to tested product files.
UI marker intentionally remains `2026-11-10-settlement-evidence-266`; SW remains shell `2026111013-266`. This is a backend storage release.
Cloud browser displayed the real login screen. Local direct Chromium network navigation failed; it is not counted as successful operating-browser coverage.

## Verified behavior and limitations

Synthetic old writer: after B cash 200 then delayed A cash 100, B incorrectly becomes 100.
New writer: A stays 100 and B stays 200, including repeat A. Actual worker forwards the same request timestamp used in the snapshot, calls cash writer once, and skips it for obsolete snapshots.
Wrong owner, absent binding/date, null/nonfinite amounts and null/anon/authenticated claims were tested. ACLs were independently checked.
The exact-commit CI passed the full Chromium/WebKit mobile suite, including 390/402/430px and zoom, period/date/NAV and decision flows.
Read-only Today/1W/THIS_MONTH before/after outputs were identical. Whole-account A/B and difference remain unavailable, not zero. No operating financial values or identifiers are included here.
Security advisor findings were unchanged; the new RPC adds no authenticated execution grant.
No claim of normal scheduled collection having exercised v84 yet. No physical iPhone, Face ID, native keyboard or full PWA termination/relaunch test.

## Next concrete work

1. Preserve missing/fractional position evidence and bind it to the originating snapshot. Additional synthetic reproduction with `hld_q_p6=ec_q_p6=0.5` and absent integer/pending aliases: holdings correctly save 0.5 but balance evidence saves settled/effective/pending as 0. The current stored domestic raw-field inspection did not show this condition; production loss is not asserted.
2. A worker-only row filter is insufficient: skipping a bad latest row can make consumers select older evidence. Design explicit completeness/provenance plus nullable unknowns, update the SQL writer and all latest-evidence/settlement consumers together, and test full sale, zero, retry, out-of-order and incomplete row behavior. Do not rewrite past financial evidence.
3. Continue normal domestic settlement ledger versus official executions and both pending buy/sell legs. Fresh bridge still reports incomplete/ambiguous; do not cancel offsetting legs or treat missing matches as zero.
4. Native cash/FX anchors, ISA historical opening evidence and time-consistent composition are still required for whole-account reconciliation. No latest ISA backdating.

This documentation-only handoff lives on the work branch; main remains the tested product commit. Recheck main, current worker, pending runs and normal collected evidence before continuing.
