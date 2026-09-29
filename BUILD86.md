# Build86 — Return to saved decisions from home

Home keeps a compact entry to the latest saved judgment for each currently held
security in the latest 100 records. Due price/date or relevant evidence items
come first; other securities stay in a collapsed list. A manual-review label
never implies that no changes or risks exist. Superseded decisions cannot bring
old conditions back. Verified saves refresh the home list on closing the detail.

The home query now includes thesis_version and price_snapshot, which its existing
evidence/price comparisons required but did not fetch. Missing quote values or
baseline dates cannot trigger a price alert. No accounting or backend changes.

Validation: targeted VM regressions cover deduplication, priority, manual access,
missing quote/baseline and evidence version. Existing mobile fixture now covers
home list expansion, opening/return at 390/402/430px and retained Build85 checks.
Local browser execution is unavailable (empty Chromium binary); mobile execution
must be confirmed by GitHub Actions. No authenticated owner/iPhone E2E claim.
