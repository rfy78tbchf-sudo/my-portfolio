# Build268 — reject incomplete domestic balance responses before replacement

## Scope and cause

This is an isolated collection-safety change, based on main Build265. The concurrent
`work/integrity-266` settlement/NAV work is not changed or promoted by this branch.
The operational `kb-sync-worker` version 82 source matched main at investigation.

The balance guard validated overseas positions and aggregate numbers but omitted
domestic row validation. A missing symbol could be skipped by normalization, and
missing/invalid quantity fields could become zero. The snapshot writer replaces
the API holdings set and removes absent positions. Domestic continuation and an
empty response contradicting a nonzero securities total were also not rejected.
This is a synthetic reproduction of an unsafe path, not proof that production
financial records were lost.

## Change

- Validate domestic identity, present quantity aliases, and valuation before any
  normalization/storage RPC. Reject duplicate domestic symbols and continuation.
- Reject both position lists being empty when the reported securities total is
  nonzero. A genuine zero-securities empty balance still clears sold positions.
- Preserve overseas normalization, stale settled-sale exclusion, financial
  definitions, source payloads, authentication and existing stale-response guard.
- No operating ledger, historical snapshots, observations, or calculation functions
  are rewritten; no UI feature or valuation fallback is introduced.

## Verification

`tests/build268_balance_response.mjs` invokes the actual `syncCurrent` function and
normalizers with synthetic upstream responses and a storage spy. Expected prior
state, quantities and valuations are fixed literals, independent of implementation.
The same 10 malformed responses reached the storage RPC 9 times before and zero
times after. All 10 now preserve the prior state with no storage calls. Six valid
cases cover ordinary balances, complete empty balances, pending full-sale rows,
fractional quantity aliases, mixed domestic/foreign holdings and explicit zero.

Local passed: Build268, Build254 independent NAV/date arithmetic and snapshot
guards, Build55 fee/tax normalization, Build104 native-price evidence and Build141
sync failure/retry/coalescing regressions. Exact commit CI and deployment outcomes
must be checked before claiming delivery.

## Operating reconciliation and remaining work

Read-only Today/1W/THIS_MONTH checks used the deployed `nav-contract-266` function.
Whole-account A, independent B and their difference remain unavailable: other
account opening evidence, cash/FX components and independent reconstruction are
incomplete. Primary-account arithmetic is not whole-account verification. Raw
operating financial values/identifiers are intentionally absent from this public
record. Current stored domestic payload fields satisfy the new required field
shapes; no broker sync was invoked as a test.

Next: finish/recheck the concurrent integrity branch delivery first, then audit
missing foreign ledger FX provenance and the original-currency cash collection
path. Do not replace missing FX by 1, fabricate history, or repeat the rejected
performance queue-priority experiments. The new guard cannot detect every omitted
row in a nonempty response without independent response coverage evidence.
