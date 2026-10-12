# Build200 — Home period and stock contribution beside the summary

Baseline: main 634c022 / Build199. Home period controls were below the asset chart while the stock route was a generic quick link. A period loading/error branch omitted that stock route entirely.

Add one compact native period selector and explicit “종목별 손익” action beside the home summary, in both normal and period-loading/error renders. Keep chart-period controls available where the chart is read. Both use the existing period loader/cache; the new stock button uses Build198's exact-period route, filters and today guards. No new financial calculations or data requests are introduced by rendering controls.

Focused period-route/account-scope/basis checks passed. The existing mobile journey now enters contribution through the summary button. The actual home-loader browser scenario changes period using the new selector and checks the stock action remains visible during pending and failed home reads. Full CI, screenshot and deployment verification completed below. Synthetic fixtures only; physical iPhone latency remains unverified.

This completes the scoped first roadmap item after verification. Next work should measure actual account access/performance and check current financial coverage, not add another cosmetic increment or repeat completed navigation changes.


## Completed verification

Commit b8a1de2dd4a225c1c386d25ae763e8d76d54ca8a. Full mobile workflow 38192550281 succeeded: Chromium 390/402/430px, existing WebKit navigation, chart and regression checks. Pages run 38192549981 succeeded. Production index.html SHA256 matches local: a2492d3d34f5b92d7298c388aeb29dcb9a6e41f3f57c45209c363190a65ef4da.

Visually inspected home-period-ready-390 and home-period-retry-390 from artifact 11722170980. The summary controls are readable and both remain available on the period-failure view. Tests use synthetic account values and do not establish current financial accuracy or physical iPhone speed.

Roadmap item 1 (scoped home entry clarity) is complete at implementation/automated verification level. Proceed to real access/timing and current-account coverage inspection. Physical iPhone Face ID, standalone resume and measured daily-use completion still require actual-device evidence.
