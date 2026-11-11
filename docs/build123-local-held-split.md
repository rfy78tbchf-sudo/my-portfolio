# Build123 — All-history local P&L for reconciled holdings and stock splits

Extend local-only all-history coverage to holdings whose full source-validated
trade ledger starts at zero and reconciles to the current holding quantity.
No pending trades, unhandled corporate event, invalid cash or negative running
quantity is allowed; held positions require a positive value at the exact
account cutoff. P&L adds this ending value to net trade cash and dividends.

Same-asset forward splits require exactly one API split-out and split-in on the
same day, zero cash, matching original quantities and exact split descriptions.
The outgoing quantity must equal the pre-split ledger balance. Every corporate
record must belong to a validated pair, the full history must close at zero and
running quantities must remain nonnegative. Reverse splits and cross-identifier
mergers are deliberately not inferred. All original records remain unchanged.

Tests: 19 held/closed-history and 16 split SQL fixture cases, zero failures.
Production preview adds four local-only rows. Prior calculated rows, KRW totals
and composition remain unchanged across ALL, month, one month and today.
Details distinguish held valuation from closed/split histories. Mobile fixtures
check both descriptions and unchanged KRW headline. No estimated FX added.

Rollback: restore Build122 SQL and frontend. No source data mutation to reverse.
