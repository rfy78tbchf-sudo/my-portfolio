# Build118 — Link split fills to broker aggregate execution dates

A settlement-ledger day can contain several fills while SSQM2442 supplies one
aggregate with a rounded average price. Build117's exact single-row matcher
could not connect these records and left their period P&L pending.

Add a second, derived-only matching path over complete groups sharing the owner
account, Korean ISIN, settlement day and buy/sell direction. Every group member
must have valid API provenance, a raw ledger day matching its stored day, and
quantity times price equal to original gross. The independent execution record
must match aggregate quantity and gross exactly. Its unit price may differ only
by the rounding allowance of half a won per share. The same original 14-day
window and raw execution-day checks apply; dates are not inferred from a
settlement-calendar rule.

Reject multiple candidates in either direction and conflicts with an already
known execution day. An evidence record cannot support both a single ledger row
and a different aggregate group. Both paths remain unresolved in that case.
Partial and cumulative broker records may coexist: only the exact aggregate is
used for the group, and it contributes a date, never an additional cash flow.
Existing order timestamps remain authoritative. Derived dates are date buckets,
not intraday execution timestamps.

No original transaction, net cash, charge or payload is modified. The return
adds grouped_date_count. The frontend explains aggregate matching only inside
the existing details. Fee/amount validation remains in force even when dates
are now fully connected. In particular a symbol can move from unknown dates to
an independently unresolved amount; it must not be shown as calculated.

Verification:
- Existing single-record cases: 16 rows, all pass against the new matcher.
- Aggregate cases: 19 scenarios / 42 rows, including partial plus cumulative
  evidence, both trade directions, duplicate evidence/ledger rows, gross/quantity/
  unit-price mismatches, source/currency/account isolation, rounding, conflicting
  known times, future dates and single-versus-group evidence reuse.
- Owner-scoped Today, this month, one month and All output: item totals equal the
  response total, the cash-flow identity balances, unresolved rows are excluded.
- Deployment verification repeats these assertions and checks an unrelated
  authenticated identity returns no account data.

The one-month result covers its current candidate set, not proof of complete
account reconciliation or all historical trading. All-history coverage, some
source charge discrepancies and overseas snapshot/day boundaries remain open.
Rollback restores the Build117 function and frontend; no ledger reversal is
required. Invoker execution, empty search path and existing ACLs are retained.
Security-advisory baseline references are recorded in the Build117 note.
