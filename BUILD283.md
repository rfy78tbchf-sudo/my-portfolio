# Build283 — revalidate settlement dates after ledger resync

The ledger writer clears an unavailable settlement date on resync. The evidence linker previously skipped rows whose order date was already known, so a second sync could leave the settlement date missing permanently despite matching active evidence.

The linker now also accepts an existing order timestamp that exactly matches the independently matched source date, when the settlement timestamp is missing. All existing source, account, uniqueness, quantity, price and date checks remain in place. Conflicting timestamps are retained. No amount, quantity, source payload, monthly record or starting baseline is changed by this patch. No direct production ledger repair is run; the existing collection pipeline will revalidate evidence normally.

The PGlite regression reproduces the old first-sync/second-sync failure and checks fixed repeated sync, idempotence, inactive or ambiguous evidence, ambiguous transactions, conflicting order/settlement dates and immutable financial fields. The existing settlement precision regression also passes. The test is included in the existing CI workflow.

This is a server-function change. The Pages UI remains Build282. Whole-account A/B and position/native-cash/ISA evidence remain incomplete. Production recurrence verification must wait for the normal collection cycle; synthetic tests are not actual-account or iPhone verification.
