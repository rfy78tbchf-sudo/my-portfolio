# Build280 — reject malformed records inside history pages

Worker90 rejects missing page arrays, but a valid array containing null, a scalar or a nested array still reached monthly writes after normalization skipped the malformed records. The monthly evidence finalizer can retire absent source keys. Actual deployed finalizer source was read to confirm this consequence; this is a synthetic reproduction, not evidence of an incident in operating history.

The candidate rejects malformed record shapes before appending any page. It does not impose guessed broker field meanings, certify completeness, infer zero quantities or change valid object/explicit empty-array behavior. No history backfill, ledger edit, calculation or authorization change.

The actual pagedTr and syncHistoryMonth regression now tests mixed valid/malformed second pages across all three monthly sources. Against worker90, all12 malformed cases reached write RPCs. After the guard, all12 write nothing. Existing missing-page and continuation guards, valid pagination and explicit-empty cases remain covered. Financial expected values and existing tests are not changed.

Baseline rechecked: main0f6a66f, worker90 ACTIVE/source-identical, main CI43068319969 and Pages43068318827 successful, version/index/sw byte-identical. No newer normal observation or later domestic settlement ledger exists. Whole A/B and source evidence limitations remain unresolved.

Pending final candidate CI and deployment. Require full CI, recheck main/work/worker, deploy the tested source through the existing route, verify active source bytes and Pages, and compare same-cutoff operating results. Do not force broker collection. Real iPhone and successful normal collection under the candidate are unverified. Keep normal-collection follow-up and the broader Build276/278 evidence work active.
