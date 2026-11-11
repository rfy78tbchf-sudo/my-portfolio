# Build120 — Whole-history foreign-currency closed positions 

Status: production migration applied successfully on 2026-10-04. Post-migration
comparison confirms unchanged KRW totals and components for all four periods.
Frontend release and mobile CI passed (commit ba7621231a6dc8cfde0a7a8b4adf90997e772d5d).

For ALL only, expose local-currency P&L for fully closed foreign positions whose
full recorded buy and sell cash flows match original broker gross and stored
fees/taxes. Opening and closing quantities must be zero, daily quantity must
never go negative, and no pending trade, corporate event, bad amount, or opening
snapshot mismatch may remain. Every recorded trade must be inside the included
history. Reject missing charges, wrong cash signs, and non-API sources.

Do not invent execution dates or use settlement-day FX. Existing reason and
pnl_krw remain unchanged. Add explicit local_cash_only and local_only_count
fields. The local amount includes the existing period net dividend amount.
This establishes the sum of available reconciled ledger records, not proof that
the broker has supplied every historical event.

The UI shows the foreign amount plus a small KRW-conversion-pending label.
KRW-ready rows retain their existing sort; local-only rows precede unresolved
rows without comparing different currencies. Local-only values never enter the
KRW headline, gain/loss subtotals, or composition. Details explain the basis.
All bounded periods retain existing calculation behavior.

Validation: 17 synthetic SQL scenarios using the actual source-validation and
eligibility CTEs, zero failures. Read-only production preview yields 48 eligible
local-only positions. Today, this month, one month and all-history KRW totals
and calculation components exactly equal the current function. Source function
was checked against Build118 with invoker execution, empty search path and the
existing restricted execute ACL. Changelog unchanged from Build118. Existing
UI regression checks pass; new mobile cases are included in the release CI gate.
Cross-account isolation and invoker permissions were verified after migration. No transactions, holdings, source amounts or permissions changed.

Rollback: restore Build118 function and Build119 frontend. No ledger reversal
is needed because this change only derives display results.
