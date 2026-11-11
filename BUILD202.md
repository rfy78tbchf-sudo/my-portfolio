# Build202 — Average-price rounding no longer blocks execution-date linkage

Deployed database migration fix_kb_order_date_average_price_rounding on 2026-10-14. Frontend unchanged (Build201).

Verified owner-scoped investigation identified one missing execution date where independent broker sources agreed on quantity, gross trade cash, net cash and settlement date, but average prices differed by one unit at six decimals. The existing exact-price match excluded this otherwise unique pair.

The service-only date linker now additionally accepts absolute price differences <=0.000001 only when net cash equals evidence cash, nonnegative fees/tax reconcile gross-to-net, both quantity-times-price products agree with gross within one cent, and every existing identity/date/source/unique-pair guard holds. Existing known dates are not overwritten. No financial amount, quantity or source price is modified. Existing service-only ACL and empty search_path retained; anon/authenticated execute=false and service_role execute=true verified after deployment.

Applied the same candidate CTE to the explicitly authorized owner: one missing date repaired. Owner-scoped authenticated period RPC then included the formerly excluded item and reported zero arithmetic difference. Its candidate set is not necessarily the whole account: another domestic official realized-sale item has no current-month cash-ledger transactions and is absent from the period universe. Do not claim complete broker reconciliation from complete=true alone. Per-sale cost ambiguity from historical mixed buy/sell days remains unresolved.

Synthetic SQL fixture passed rounded match, wider price mismatch rejection, net mismatch rejection, fee mismatch rejection and duplicate evidence rejection. Production before/after queries verified repair and ACLs. Private account identity, holdings and amounts are not committed. No physical iPhone performance claim.

Security advisors were run. Separate findings remain for pg_net in public, four unrelated authenticated SECURITY DEFINER functions, disabled leaked-password protection, and two RLS tables without policies. This change does not modify these objects. References: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection ; https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

Roadmap 3 remains incomplete. Next: domestic official-only period coverage and historical cost/order evidence, followed by like-for-like broker reconciliation.
