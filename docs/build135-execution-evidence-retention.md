# Build135 — Retain settled execution-date evidence

The history worker previously discarded SPQM2205 rows as soon as a same-sized
settled ledger row existed. That removed the independent order date before the
service linker could use it. Retain those records; existing P&L and reconciliation
queries already exclude ledger-matched evidence from pending positions.

The linker now requires the same owner account, US ISIN, direction, currency,
quantity, price, raw gross trade amount and settlement date. Raw date fields must
agree and settlement must be within ten calendar days of the stated order date.
Both directions must be unique, including ledger rows with already-known dates.
Known order dates and conflicting settlement dates are never overwritten.
Older evidence lacking the new validation metadata remains unresolved.

Repeated identical source signatures are stored once with an occurrence count;
they cannot silently become unique date evidence. Complete monthly source revisions
are retired before linking. Evidence writes use the existing 300-row batch limit,
with the existing 2,000-row monthly source-key bound enforced explicitly.

Validation: 24 synthetic SQL matcher cases passed, including ambiguity, existing
dates, account isolation, malformed gross amounts, raw-field disagreements and
invalid source/currency. Worker regression confirms preservation of settled rows,
duplicate detection, unchanged settlement cash, and bounded batches. Domestic
ledger normalization regression passed. Service-only RPC permissions remain
unchanged; worker authentication and order-endpoint restrictions are unchanged.

This release fixes evidence collection going forward and on historical re-fetch.
It does not claim that missing historical dates have already been recovered.
Previously discarded records require a fresh broker query; unavailable or
ambiguous records remain excluded from exact period P&L. No arbitrary settlement
lag is used to invent execution dates. The order date provides a day bucket, not
an observed intraday execution timestamp.

Rollback: restore worker version 77 and the prior service linker. Retained source
records are auditable; do not delete records or overwrite independently known dates.
