# Build127 — reconcile whole-history dividend taxes and identity

Whole-history foreign P&L previously added dividend receipts but omitted separately booked withholding, refunds and KRW recapture outside consolidated corporate chains. A stale dividend security reference could also create a duplicate row under the wrong security currency.

The read-only period P&L function now resolves a dividend's security from a unique exact API event match: external identifier, payment timestamp, currency, receipt amount and broker security identifier. Ambiguous matches retain their original identity; symbols alone never merge securities.

For ALL, USD dividend and tax events are validated against raw broker amounts, identifiers, dates, currency and cash direction. Adjustments require gross-equals-net receipts with no embedded tax, matching ledger totals and receipt counts. Already adjusted corporate chains are excluded. USD tax/refunds update local P&L and net distributions; KRW recapture stays separate for unconverted rows and is included once in the existing KRW overview. Already convertible rows use historical daily FX for the tax, with missing FX preventing a partial converted result. Other period tax handling is unchanged.

Source transactions and dividends are not rewritten. The function remains SQL STABLE, invoker-security, with an empty search path and existing grants/RLS. The UI exposes the number of verified tax/refund events and their currency, and updates its offline cache version.

Validation:

- Synthetic SQL tests: 14 tax cases including embedded tax, receipt mismatch, malformed source, wrong sign, currency, identifier/date, unknown/manual events, corporate duplicate prevention and missing FX; seven exact-identity cases. All passed.
- Owner-scoped full-history audit: every in-scope foreign tax event covered by either the new validated path or the existing validated corporate path; no invalid source events. Full numeric row coverage retained after removing one stale duplicate. Trading cash, ending quantities and previously corrected corporate totals unchanged.
- Existing period-evidence, local-history, composition and mixed-currency subtotal tests passed. Mobile CI validates responsive rendering and the existing complete app flow.

These checks establish cash-event reconciliation for the available account records, not complete historical KRW conversion or independent verification of every past transaction.
