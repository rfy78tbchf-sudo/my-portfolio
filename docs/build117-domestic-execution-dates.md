# Build117 — Recover domestic execution dates from independent broker evidence

Build115 correctly rejected unknown execution dates but this left domestic
period rows pending even when an independent SSQM2442 record supplied the day.
SWQA2301 ledger dates are not automatically execution dates: the production
review found a month-boundary sale whose ledger record is in the next month.

The period-P&L RPC now derives dates for a strictly one-to-one match by owner
account, Korean ISIN, buy/sell direction, quantity, unit price and gross amount.
Both inputs must be API records; SSQM2442 identity and raw execution-day fields
must agree. The original ledger day must agree with its raw field. Matches must
be within 14 calendar days, but no T+2 or holiday-derived date is invented.
Multiple candidates on either side, malformed money, cross-account matches,
foreign trades and conflicting fields remain unresolved. Existing order_at
values win. The recovered day uses midnight only as a date-bucket boundary;
it is not an observed execution timestamp or an intraday ordering guarantee.

The derived date is used consistently for period selection, opening quantity,
trade flows, closed-cycle checks and coverage. Original transactions, cash,
fees, taxes and broker payloads are not rewritten. Independent broker P&L is
not added to ledger P&L. The response adds verified_date_count; the frontend
shows this only in the existing expandable row detail. Main layout is unchanged.

Validation:
- Sixteen synthetic SQL cases execute the matcher extracted from the deployed
  function source (node tests/build117_execution_dates.mjs emits the SQL).
  They cover both trade directions, ambiguity in both directions, account
  isolation, amount/price/quantity mismatch, malformed input, currency/source,
  raw date disagreement, excessive date distance and preserving known times.
- Owner-scoped production checks pass for Today, this month, one month and All:
  item sums, calculation identity and exclusion of unresolved items.
- An unrelated authenticated identity returns no account and zero items.
- Existing period loading, amount decomposition, reconciliation, Today journey
  and invalid-row renderer regressions pass.

Full period coverage and complete account reconciliation are still incomplete.
Partially matched histories, overseas day boundaries, missing opening evidence
and amount discrepancies remain gated. No claim of owner iPhone E2E testing.
Rollback: restore the Build115 function and the Build116 frontend; no data
rollback is needed because the change does not mutate ledger records.

Security review: the existing invoker function, empty search path, stable flag,
and authenticated/service ACLs are preserved. No table, policy or grant was
added. Security advisories are unchanged from the pre-change baseline.
Existing advisory references: [extension placement](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
