# Build142 — first-load state and short foreground refresh

Initial home shows loading until the first account response arrives. Empty connected-account state is shown only after a response. The progress pill sits above bottom navigation instead of covering total assets.

Manual refresh updates current balance and reads stored app data first. History months and historical prices then update in the background with one shared task. Successful current-month reads are reused for five minutes; previous-month and historical-price reads for one hour within the current app session. Failed steps remain eligible for retry. Logout clears timestamps. Explicit full-sync controls retain their existing behavior.

After successful background changes, stored data is reloaded and the current scroll position is preserved. Foreground completion says balance refreshed; the small header badge indicates history updates and partial failures. Background reads do not change financial formulas or remove records.

Synthetic tests cover the initial no-account-yet state, balance-only foreground, overlapping background calls, freshness windows, failed-step retries, and progress placement. No end-to-end latency improvement is claimed without device measurements.
