# Build124 — Consistent whole-ledger chronology for local-only P&L

Mixing known execution dates with unresolved ledger dates can produce an artificial
negative running balance even when the full settlement ledger is reconciled.
For ALL only, fully closed foreign positions may use a separate whole-ledger
quantity validation to expose local cash P&L. This does not supply execution dates
or allow settlement dates to be used for FX or bounded period attribution.

Every trade must be API sourced with a positive quantity, a raw ledger date equal
to its stored ledger date and a date within cutoff. Daily running balances cannot
be negative and the final quantity must be zero. Existing exact cash validation,
full trade counts, no pending trades, no corporate events, zero opening/ending
quantity and no snapshot discrepancy remain mandatory. Prior eligibility is
unchanged. Original transactions are never rewritten.

16 actual-CTE SQL fixture cases pass. Production preview restores two local rows;
all previous calculated items and KRW totals/components remain unchanged for
ALL, today, month and one month. Mobile details explain the whole-ledger basis.
Rollback restores Build123 function and frontend.
