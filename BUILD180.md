# Build180 — Prioritize daily home review before enrichment

Baseline: 53e684eefc1abaafadd4c60c093fa65d74b835be, Build179. Code-confirmed bottleneck: home review decisions/quotes/evidence were queued after cash-flow reconciliation and published only after the entire analytical batch. A refresh also recreated empty review arrays, and a core failure masked the retained home with an error-only screen.

## Change

Read the three existing home-review sources immediately after core account readiness. Publish the review section independently of reconciliation, history and analytics, and reuse the same promises in enrichment (no duplicate reads). Preserve previously confirmed review data during refresh for the same authentication epoch, explicitly label pending/failing review updates, and retry only those three sources from the local retry button. New saves made during the read remain present; later enrichment cannot replace the independently published review data. A failed core refresh retains the prior home and offers retry.

No server/database changes, automatic decisions, synthetic real-account writes or new analytics. First account readiness still uses the existing critical reads. No durable account-summary cache is added: full process restart still needs network account reads. Cold login restoration and broker synchronization performance are not claimed improved.

## Controlled measurement (Node production functions, not live latency)

The real three-read queue and load functions ran with 40ms per read, 350ms reconciliation, and synthetic responses. Single runs, rounded; no statistical or actual-iPhone claims.

| Scenario | Before | After |
|---|---:|---:|
| First open: account ready | 127ms | 127ms |
| First open: home review ready | 928ms | 169ms |
| Full page reopen: home review ready | 920ms | 164ms |
| Refresh: fresh home review ready | 918ms | 163ms |
| App resume within existing 3-minute freshness window | 0.13ms | 0.11ms |
| First period query (40ms fake RPC) | 40.72ms | 41.93ms |
| Return to cached period | 0.03ms | 0.03ms |

During refresh the old review remains present until the fresh result; measured first post-core render is 122ms in both runs. The existing period cache and short-resume skip already worked and were retained. The large review gain is from removing the wait for unrelated reconciliation and enrichment, not faster financial calculations.

## Verification and remaining gaps

Production-function checks cover a blocked reconciliation with home already ready, single source query per load, same-account retention, local three-read retry, failed core preservation, owner isolation, late response suppression, and existing period/cache/scroll behavior. Synthetic 390/402/430px browser tests exercise readable home while enrichment is unresolved, failed review retrieval, retained saved reason and local retry. CI/deployment pending.

Actual signed-in iPhone measurements, network variability, broker synchronization duration, cold-session recovery and the 30-second/one-minute comprehension goals remain 확인 필요. Next priority: measure actual startup/revisit and consider an authenticated last-confirmed home cache if network waiting remains the largest daily obstacle. Do not infer completed daily usability from these synthetic timings.
