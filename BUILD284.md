# Build284 — reject incomplete sold-row evidence before snapshot replacement

A domestic row with positive settled quantity, zero valuation and sufficient pending sells is filtered as sold when cost and available quantity are zero. The validator did not require those last two fields. The numeric normalizer converted absent, blank or invalid values to zero, allowing a partial response to remove a holding.

The worker now validates cost and available quantity for that candidate before any storage RPC. Incomplete evidence rejects the snapshot and preserves previous holdings. Explicit zero-valued sold rows and genuine empty balances remain supported. This is a conservative completeness guard, not a change to quantity interpretation or settlement accounting.

The existing required balance regression now covers ten additional synthetic absent/null/blank/invalid field cases. The unpatched worker fails the first new assertion; the patched worker rejects all twenty invalid cases before storage and preserves the six valid response cases. Current UUID-bound worker/storage integration, foreign P&L, paginated history, foreign gross/net and settlement revalidation tests are checked separately. The legacy adapter invocation without --uuid-schema uses an obsolete experimental schema; the production CI invocation includes --uuid-schema.

No new collector, broker call, schema change, historical balance correction, monthly amendment or baseline change is included. UI remains Build282; linker remains Build283. Source deployment and CI must match this candidate before rollout. Normal collection after deployment is still needed to verify operating behavior. Physical iPhone and actual-user login are unverified; whole-account A/B remains incomplete.
