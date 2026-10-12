# Build200 — Home period and stock contribution beside the summary

Baseline: main 634c022 / Build199. Home period controls were below the asset chart while the stock route was a generic quick link. A period loading/error branch omitted that stock route entirely.

Add one compact native period selector and explicit “종목별 손익” action beside the home summary, in both normal and period-loading/error renders. Keep chart-period controls available where the chart is read. Both use the existing period loader/cache; the new stock button uses Build198's exact-period route, filters and today guards. No new financial calculations or data requests are introduced by rendering controls.

Focused period-route/account-scope/basis checks passed. The existing mobile journey now enters contribution through the summary button. The actual home-loader browser scenario changes period using the new selector and checks the stock action remains visible during pending and failed home reads. Full CI, screenshot and deployment verification pending. Synthetic fixtures only; physical iPhone latency remains unverified.

This completes the scoped first roadmap item after verification. Next work should measure actual account access/performance and check current financial coverage, not add another cosmetic increment or repeat completed navigation changes.
