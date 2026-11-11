# Build115 — Reconcile period opening values to observed balances

Live review found that account Today P&L used prior/current account observations, while stock Today P&L used an older stored closing price as its opening value. Equal labels therefore represented different observation boundaries. A zero stock formula difference alone was not proof of account reconciliation.

The period stock function now prefers the exact prior-boundary daily security snapshot joined to its account snapshot. It requires matching timestamps, positive quantities/values/FX, matching currency, and consistent FX across aliased rows. Its quantity must agree with the reverse trade calculation. Today requires that observation when opening quantity is positive; it no longer silently substitutes an older close. Other periods retain explicitly tagged historical-close fallback where a boundary snapshot is absent. Trades with unresolved order dates now remain unresolved rather than implying complete period coverage.

Each stock response includes opening_basis. Existing ending minus opening plus net trades and dividends arithmetic remains; transaction, balance and cash-flow records are not modified. Owner filtering, invoker execution and existing ACLs remain unchanged.

Verification: temporary replacement inside a rolled-back transaction, then authenticated-owner SQL assertions and post-deployment requery. The live Today gap materially narrowed but a residual remains unexplained; it was not assigned to FX or injected as profit. Month coverage is partial after identifying opening-quantity mismatches and an unresolved trade date. Neither month total nor entire historical accounting is claimed complete. Exact private amounts remain outside the public repository.

Tests assert item sum, cash-flow identity, exclusion of unresolved items and Today opening source. Mobile regression passed at 390/402/430px. Supabase advisory baseline has pre-existing findings; this change creates no tables, grants or definer functions. Existing public extension advisory reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
