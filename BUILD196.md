# Build196 — Keep confirmed home values on a failed local refresh

Baseline: main 8106c6d / Build195. A failed chart request in loadStartupHomeData replaced a previously confirmed home chart with null. The same happened to selected-period and today performance values. This made retries erase information the user had already seen.

Retain failed fields only when a confirmed value exists for the same selected period and Korean day; today has its own day guard. Successful responses, including empty responses, replace old values normally. Failures for other periods or days never borrow previous results. The existing inline retry notice names retained areas and says previous confirmed values are displayed. Keep that warning during an ongoing retry instead of briefly implying success. No schema, financial calculation, account values or save behavior changes.

Regression reproduced against baseline, then passed for chart/performance retention, field failure labels, period/day isolation and successful/empty recovery. Existing startup race guards, resume retry and home basis tests passed locally. Updated the prior startup contract that expected chart erasure. Mobile startup-failure test now requires the chart and confirmed performance to stay visible with the retained-value notice before recovery.

Mobile CI and production visual verification pending. All test data is synthetic; no real account writes. Physical iPhone return and one-minute daily-use goal remain unverified. Retention here covers local home retries on the current loaded target; a full reload creates a new target and retains its existing startup behavior.
