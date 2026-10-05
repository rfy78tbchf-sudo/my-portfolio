# Build136 — Historical execution-date recovery and replay regressions

The normal app refresh revisits the current month and, near month boundaries,
the preceding month. It does not replay all historical months after a parser fix.
The Build135 collector was therefore re-run sequentially through the existing
authenticated internal worker for the older months required by the annual views.
All requests completed successfully. Broker credentials stayed server-side.

Two replay regressions were corrected:

- The history importer let a separate KRW tax transaction replace a foreign
  security's denomination. Existing security currency now changes only on buy
  or sell records; tax, distribution and other cash rows retain their independent
  transaction currency. A conservative metadata repair uses unanimous API trade
  currencies that also agree with each original raw currency field. It changes
  neither transaction cash nor tax amounts.
- A verified closed split history was gated on the text "execution date needed".
  Recovering its dates changed that reason to "split/transfer needed", dropping
  an otherwise fully verified history. The same full-history split verification
  now accepts either reason. Paired raw split records, quantities, cash, full
  history coverage and nonnegative chronological balance remain mandatory.
  This does not enable unverified or bounded-period corporate-action calculations.

Verification:
- 19 split fixtures, including known dates, missing pairs, bad cash, wrong raw
  quantities, duplicate events, unrelated transfers and future trades: passed.
- 8 importer currency fixtures for domestic/foreign trades and separate-currency
  cash events: passed.
- Owner-scoped month/quarter/half-year/year/all RPC checks: response success,
  no duplicate output security IDs, and zero calculated-subset composition gap.
- Full-history native-currency coverage restored after both replay regressions.
  Source records and grouped display items are counted separately.

Remaining bounded-period exclusions still include raw cash/financing components,
corporate-action boundaries and unmatched execution records. Coverage increases
are not an independent broker P&L reconciliation and do not imply all periods
are complete. No dates, fills or profit amounts were invented.
