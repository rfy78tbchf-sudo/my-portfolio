# Build280 — reject malformed records inside history pages

Worker90 rejects missing page arrays, but a valid array containing null, a scalar or a nested array still reached monthly writes after normalization skipped the malformed records. The monthly evidence finalizer can retire absent source keys. Actual deployed finalizer source was read to confirm this consequence; this is a synthetic reproduction, not evidence of an incident in operating history.

The candidate rejects malformed record shapes before appending any page. It does not impose guessed broker field meanings, certify completeness, infer zero quantities or change valid object/explicit empty-array behavior. No history backfill, ledger edit, calculation or authorization change.

The actual pagedTr and syncHistoryMonth regression now tests mixed valid/malformed second pages across all three monthly sources. Against worker90, all12 malformed cases reached write RPCs. After the guard, all12 write nothing. Existing missing-page and continuation guards, valid pagination and explicit-empty cases remain covered. Financial expected values and existing tests are not changed.

Baseline rechecked: main0f6a66f, worker90 ACTIVE/source-identical, main CI43068319969 and Pages43068318827 successful, version/index/sw byte-identical. No newer normal observation or later domestic settlement ledger exists. Whole A/B and source evidence limitations remain unresolved.

Initial handoff required final candidate CI and deployment. The verified rollout receipt below supersedes that pending status. Do not force broker collection. Real iPhone and successful normal collection under the candidate are unverified. Keep normal-collection follow-up and the broader Build276/278 evidence work active.

## CI artifact-service failure and retry

Run43094793783 attempt1 passed the decision regression and every mobile verification step, including Chromium/WebKit widths390/402/430 and125% checks. The final upload-artifact step failed after retries because the GitHub artifact service returned non-JSON HTML/upstream responses during creation/finalization. This is a failed CI run, not a successful required-check result, and not a reproduced application test failure. The failed job was re-run on the identical4083724 source; no checks, assertions, workflow gates or artifact uploads were removed or relaxed.

Fresh preflight: main0f6a66f and worker90 remain source-identical; live version/index/sw match Build275; operating NAV/flow SQL hashes match Build278. Bound observations have no missing links, account/time mismatches or duplicate observation IDs. No later normal observation or domestic settlement ledger was available. Source-table fingerprints were captured privately for the eventual deployment comparison. Normal scheduled collection is not forced. At that preflight, deployment remained pending until the retry result was verified.

## Verified rollout receipt — 2026-11-12 KST

[Required CI43094793783 attempt2](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43094793783) succeeded including the artifact upload; decision regression and mobile jobs both succeeded on4083724ebe289cb9c22ca468f0c3a7595fb13aa9. The retry did not change source or reduce verification. After a fresh conflict/source check, the existing worker was deployed asv91 ACTIVE with exact source bytes and its existing authentication configuration preserved. Main advanced to that tested commit using an expected-SHA lease.

[Pages43109218133](https://github.com/rfy78tbchf-sudo/my-portfolio/actions/runs/43109218133) succeeded on the same commit. Live version.json/index.html/sw.js match the repository byte-for-byte. Frontend remains Build275 because this release changes the collector only. The main-triggered duplicate CI43109217783 is separate from the already successful required candidate run.

Transactions, cash flows, account observations and daily account snapshots have identical before/after counts and full-row fingerprints. Same-cutoff TODAY/1W/THIS_MONTH operating reads preserve recorded arithmetic and unverified-flow/whole-account states. Financial values remain private. There is no claimed actual P&L improvement or actual malformed-response incident.

Remaining: first normal collection underv91; later domestic settlement/position matching; complete external-flow coverage; native cash/FX and ISA opening evidence; independent whole-accountB and unexplained differences. Do not force collection, backdate current evidence or fill unknowns. Chromium/WebKit synthetic regression passed; actual user login/iPhone remain unverified. Overall completion criteria are NOT met.
