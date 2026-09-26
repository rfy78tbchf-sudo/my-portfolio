# Build 56 completion ledger

The objective is an owner usable investment decision flow. A code path or a
successful unauthenticated page load alone does not complete a feature. Private
account data, account IDs, holdings and prompts are intentionally absent here.

| Area | User question | Current implementation and evidence | Status | Next completion condition |
| --- | --- | --- | --- | --- |
| Operations and sync | Are current balances and source records arriving? | Scheduled KB account/history sync and preserved original payloads; post deployment targeted SNDK chart backfill completed through the existing worker. | Actual data verified for those calls | Verify the next routine history run and account contents, not only record counts. |
| Ledger integrity | Are costs and cash counted once? | 595 domestic fee/tax derived splits; source net cash and provider payload unchanged. Synthetic gross 1000 / fee 2 / tax 1 / net 997 case. | Actual data and automated test | Reconcile three open historical cash gaps with independent broker cash fields. |
| Sales and performance | Which sales and periods can be explained? | 9 per sale results; 9 more have computed `realized_local` but no evidenced execution date window; 36 order sensitive results group into originating events. The latest consistent source gives a limited valuation movement for unchanged quantities, while other quantities differ without linked trades. | Partial actual data | Obtain official fill sequence/date evidence, verified opening positions and cash, and independently explain the quantity changes before publishing a complete monthly return or attribution. |
| Price identity | Does a historical quote belong to the correct security? | SEC ISIN and Sandisk issuer ticker establish SNDK on NASDAQ; KB USD historical bars were obtained through the corrected existing security ID. | Actual price data verified | Confirm position ownership at the chosen opening date; a price alone does not prove a position existed. |
| Risk, benchmark, scenario | How does a changed weight or price affect the account? | Existing server calculations and account scoped components retained. | Automated test, owner flow pending | Check authenticated scenario result and its account date/scope against the displayed figures. |
| Thesis and AI | Can the owner's reasoning be challenged and saved? | Owner authored thesis versioning, model request ID and retained response save retry tested with a mock. No production owner request or history recorded; model credential availability in Edge runtime is unverified. | Code and automated test, actual model pending | Use an approved model key and an authenticated isolated account to verify actual provider call, save and reopen; then test owner login separately. |
| Review and mobile | Can a completed decision be revisited on iPhone? | Sale source trace and history controls exist; there is no historic user thesis to attribute to earlier trades. Mobile emulation at 390/402/430px and zoom uses the production components. | Automatic verification; authenticated owner and actual iPhone pending | Link an independently closed trade with actual earlier decision record, or state that no decision record exists; verify the authenticated flow on the owner's device. |

## Recovery and provenance

The correction changes a security's derived ticker and venue, plus a derived
price collection retry; it does not alter a transaction ID, quantity, cash
amount, or original broker payload. The canonical mapping proof remains in
`security_symbol_resolutions`. `get_live_realized_sales` retains its signature
and moving average policy; it now keeps an originating mixed day in the output
when an affected sale closes a position. Previous frontend and worker builds
remain schema compatible. Rollback requires restoring the prior worker and
frontend, while retaining the historical price bars and broker source records.
