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

## Build 57 decision flow

| User question | Entry path and result | Evidence and remaining condition |
| --- | --- | --- |
| What should I check first? | Home → **지금 점검할 것**. Shows the largest observed holding, a conditional 10% price change, and buttons for thesis and AI. The share and cash comparison appear only if the owner-scoped server metrics align with the broker position cut. | Isolated server mock, misaligned cut gate, and mobile component tests. The combined asset denominator includes an ISA observation from a different time, so its weight remains explicitly a reference. Authenticated owner view pending. |
| Why am I holding it? | Home → **보유 이유 보기** → security detail. The owner-authored thesis and its versioned edit appear above technicals and the collapsed trade ledger; general AI analysis remains available when no thesis exists. | Existing owner-scoped thesis RPC and isolated tests; an actual owner-authored thesis has not been entered. No earlier rationale was fabricated. |
| What if I trim it or its price changes? | Home or security detail → enter a target share or price assumption → existing owner-scoped scenario RPC. A scenario changes cash composition before costs, not investment profit. | Isolated provider mock verifies a user-selected target and server amounts. Provider and owner-account execution pending. |
| Can I ask AI and reopen the answer? | Home → **AI 의견 받기** opens and sends the selected security question through the existing JWT, response-staging, history, and retry pipeline. Three lead lines now keep the account basis and options visible before expanding. | Mock call, save, read, and retry verified. Production request/history were still zero at implementation time; an actual model call and authenticated owner review remain unverified. |

Historical sale exceptions remain in the data detail and preserve their original
limitations; this flow does not promote them to current portfolio performance.
Rollback of Build 57 restores the prior frontend and investment-assistant v32;
no database schema or broker source was changed.
The Build 57b follow-up rejects ambiguous multiple-percentage questions instead
of treating the current share as a target, and changes the request ID when the
primary account observation changes. The owner must still submit the first
authenticated model question to verify production history.

## Build 58 evidence and review

| User question | Implemented path | Verification and remaining condition |
| --- | --- | --- |
| Does an official company report address my reason for holding? | Security detail → saved thesis → AI review. The existing OpenAI search is limited to the public company identity and official issuer/SEC domains; a linked document and its AI summary are stored with the answer. Publication day is marked confirmed only if it can also be found in the linked HTML. The reporting period remains an AI reading of the document. | Isolated search and date tests pass; ARM's official Q1 fiscal 2027 shareholder letter dated July 29, 2026 is independently available. The owner's new request must still verify that the deployed search returns that document and a useful model answer. If the source cannot be verified, the page says official evidence is unavailable. |
| What did I know when I made this choice? | Existing owner decision RPC now captures the linked source metadata, thesis version, available price record, account valuation basis, and a server calculated ±10% example in append-only columns. The user's own choice and reason remain separate from the AI response. | Live schema and RPC definition checked; existing analysis rows retained. No owner decision existed at the time of change. Target-weight scenarios are not captured in the decision snapshot yet, so the stored example does not claim to be the user's chosen target. |
| What changed after my choice? | Reopening the security compares documents actually published after the decision with the saved source URLs, a same-currency later close, and owner-scoped broker ledger entries. A document fetched again with an older publication date creates no event; free-text review conditions stay unverified unless a clear present-close rule can be checked. The home surfaces a saved decision only when a new dated official source is stored or the owner-entered calendar date is due. | Isolated tests cover same source re-fetch, genuinely later document, another holding, missing date, price currency mismatch, and plan versus recorded trade. Owner follow-up after time passes is pending; the existing 30-row activity window cannot establish absence of trades. |

The Build 58 schema is additive; no original transaction, cash, thesis, or
historical answer is rewritten. The previous frontend and Edge function remain
compatible with the new nullable/defaulted evidence columns. To revert the
product flow, restore the prior frontend and Edge version; retaining the extra
snapshot columns preserves new owner decisions and permits future migration.
