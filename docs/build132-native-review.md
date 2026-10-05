# Preserve period P&L into stock review

The existing held-stock review journey now carries verified local-only currency P&L into its context banner. Separate KRW tax remains separate, provisional settlement is identified, and the selected period is retained. No amounts are recalculated or converted. Existing converted KRW rows retain their display and do not add tax again.

Coverage: USD negative/zero/missing values, converted rows, stale period isolation, and mobile performance-to-detail navigation with separate tax. No database or model behavior changes.
