# Build288 — validate settlement dates inside the history write transaction

The history writer clears a derived settlement date when the incoming ledger does not supply one. The worker previously restored it only in a later RPC. An interruption between those calls could leave a committed missing date even when matching evidence was already stored.

The writer now calls the existing evidence linker before recording success and returning. The ledger write and validation commit together; a linker error rolls back the writer. The later worker call stays in place to handle evidence fetched after the write. Matching rules, known-date conflict rules and financial normalization do not change. Missing, inactive or mismatched evidence still cannot certify a date.

The migration only replaces the function definition and checks the expected previous body to avoid overwriting concurrent work. It does not call the writer or change stored financial rows, finalized monthly records, source observations or the initial baseline. Existing service-only execution privileges and empty search path are preserved. No new schedule or workflow is created; the existing settlement CI test includes the integration fixture.

Synthetic integration tests reproduce the old committed date gap, check literal order and settlement dates across three repeated writes, and force linker failure to prove financial fields and success logging roll back together. Inactive evidence and changed quantity must remain unverified. This closes an interruption window; it does not eliminate all repeated writes or complete whole-account A/B reconciliation.

Pages remains Build282 and the worker remains v97. Operating source/privilege checks and the next normal history collection must be distinguished from local synthetic tests. No physical iPhone verification is claimed.
