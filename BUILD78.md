# Build78 — P&L reconciliation audit and FX consistency

Read-only production audit of the current month found matching opening quantities
for all 22 included securities after incorporating recorded split/transfer movements.
An apparent SOXS discrepancy was explained by a recorded reverse-split incoming
quantity; no records or totals were edited to force reconciliation.

Confirmed defect: realized accounting preferred most recently observed FX while
period accounting preferred KB snapshots on the same rate date; lookback windows
also differed. Both now use date descending, KB preference, observation descending,
source and rate tie-breakers, positive rates and a seven-day historical window.
Ending portfolio valuation continues to use holding-snapshot FX.

Period API now exposes opening/ending valuation, net trading cash and net dividends
from calculated securities only. The UI provides a collapsed calculation breakdown.
This is arithmetic transparency, NOT independent broker certification. Current
acquisition-relative unrealized P&L stays unchanged. Unresolved realized bases,
intraday trade order, pending execution costs and unverified ledger dates remain
unresolved. Full realized/unrealized period attribution is still incomplete.

Validation: read-only live quantity reconciliation; zero arithmetic residual; SQL
synthetic conflicting FX-source tie test; mobile fixture regression. No owner
transactions or decisions mutated; no auth impersonation. No Edge Function change.

Also fixed comparison scope matching for ticker/ISIN aliases of the same canonical
security. Aliases are sourced from server security identity mappings, never guessed
from display names. Unit fixture checks realized rows are not dropped by alias.
