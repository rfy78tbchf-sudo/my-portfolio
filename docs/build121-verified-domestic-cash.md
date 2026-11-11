# Build121 — Reconciled domestic sale deductions

The period P&L check previously rejected all net/gross differences above five
percent, even when the original broker cash and stored charges reconciled.
Allow that specific check to pass only for API KRW sales whose original gross,
original nonnegative cash, original fee, stored fee/tax and quantity-price gross
all agree. Gross permits only the existing half-won unit-price rounding range.
All date, quantity, corporate-action, snapshot and FX checks remain unchanged.
Pending trades cannot use the exception. No ledger values are modified.
Negative raw cash, missing/malformed values, wrong fees, unmatched charges and
unexplained loan/other deductions remain excluded.

Validation: 15 SQL cases passed against the actual eligibility CTE. Production
preview adds two all-history KRW rows; comparison by security ID confirms every
other item is unchanged. Bounded period previews (today/month/one month) are
unchanged. KRW calculation identity remains zero; local-only coverage unchanged.
Migration applied on 2026-10-04. Release CI contains the regression harness.
Rollback: restore the Build120 function. No transaction reversal is required.
