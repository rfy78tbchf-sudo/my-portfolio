# Build 266 — trace settlement components without inventing P&L

The recorded NAV can differ from securities plus current cash while trades are
unsettled. The previous contract reported that gap but could not connect it to
independent execution and settlement records. It also reused a legacy flow-date
heuristic based on NAV changes, which is not independent evidence.

This release adds an owner-scoped, read-only settlement bridge. It matches
domestic settlement batches to official execution-day records by security,
side, quantity and gross amount, checks the original ledger cash, and compares
both outstanding buy and sell quantities with balance observations. Canonical
domestic symbol aliases are linked using sourced ISINs. Split fills are grouped;
ambiguous matches, missing cash, duplicate evidence and incomplete quantities
remain unknown. A net-zero position change must still account for both legs.

The bridge returns source transaction/event references, source times, the
matched internal settlement cash and any exact unexplained component gap. It
does not add settlement proceeds to income or external flows, modify historical
records, infer native cash, or certify whole-account P&L. Historical collectors
did not save a shared response ID for position and NAV evidence, so valuation
time verification remains false even when quantities and amounts agree.

The NAV contract now uses recorded cash-flow timestamps rather than the legacy
NAV-residual timing heuristic. Missing foreign-flow FX and non-KRW manual
adjustments without a conversion basis stay unknown. Recorded flows are not
certified as account-reflected flows. Manual-adjustment and flow-coverage
changes, plus settlement evidence, participate in the data version.

Home and P&L show this evidence inside the existing reconciliation detail.
The primary total remains unavailable when whole-account evidence is missing;
stock-only estimates remain separately labeled. Current account breakdown
labels now handle a same-screen broker/ISA observation without calling the
screenshot an automatic API response or claiming its capture times differ.

Validation before publication:
- PGlite: fixed synthetic cash amounts; split fills; correction with an exact
  one-unit residual; duplicates; missing/future-dated records; buy/sell legs with
  unchanged quantity; settlement day; user isolation; missing flow FX; manual
  adjustment correction and data-version invalidation.
- Existing date/arithmetic/partial-response guards, account-scope/current ISA,
  correction, shell update, cache, refresh, and saved-decision tests pass.
- Chromium: 390/402/430px, 125% zoom, nested evidence, unknown versus zero,
  stock/all-account switching and retained home/P&L period pass.
- Operational owner-scoped reads independently match some historical domestic
  settlement components, retain an exact nonzero difference on another date,
  and preserve unknowns for unsettled trades without settlement cash.
- Operational SQL migration: `independent_settlement_attribution_266` applied;
  calculation version `nav-contract-266`. Financial source rows are unchanged.
- WebKit/required CI and actual Pages delivery must be checked on the published
  commit. Browser emulation is not physical iPhone verification.

## Remaining priority

Whole-account A/B reconciliation is still incomplete. The current schema lacks
historical native-currency cash/FX anchors and complete ISA opening valuations.
Outstanding settlement cash and source-time linkage also remain incomplete.
Do not turn a matching domestic settlement component into a verified account
return. Next, inspect subsequent settlement records and original balance fields,
preserve auditable valuation/cash evidence during normal collection, and verify
cash FX independently. Avoid duplicate collectors or invented historical data.
The asset composition map still uses a residual category for data from different
observations; it must not be promoted to a verified cash/ISA decomposition.

The existing hourly development task was updated to prioritize integrity over
standalone performance work and to stop only when the user's completion criteria
are actually met. Inspect current main and active work before further changes.
