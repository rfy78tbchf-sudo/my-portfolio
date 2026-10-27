# Build222 — 홈에서 구성 금액까지 짧게 읽기

Baseline: main 5ce7f8c2c129fb4ee73708096bcea78c56d58cb5 (Build221), successful CI and Pages; no open PR or active recent run. Existing performance branches are historical, including the previously documented alternative 218.

## Candidates and selection

1. Home density: October 26 home capture and current source both repeat the selected period below the selected chip and use a 320×180 composition map before the amounts. Remove that repetition and use a proportional 320×140 map. Highest-confidence bounded improvement.
2. Portfolio readability/return: Build217 and existing synthetic journey already cover amount/P&L labels, four visible positions and selected-detail return. Preserve, do not redesign.
3. Chart touch: inspect date/value selection and vertical-scroll interaction next; do not change without a reproducible interaction problem.

Account tools are already folded. No new home review queue, smaller type, reduced contrast, changed amounts, currency aggregation or additional tap to view an amount. The selected chip still names the period; asset-change and deposit inclusion labels remain. Map denominator, areas, missing-value warning, full list and composition basis remain unchanged.

## Acceptance and verification

- Chromium synthetic baseline → changed first composition amount top: 390px 890.19→821.44; 402px 898.20→827.95; 430px 916.92→843.17 CSS px (approximately 69–74px less scrolling). Font-dependent coordinates are diagnostic, not financial values or universal device measurements.
- Existing home suite checks asset→trend→composition, 44px portfolio entry above navigation, four holdings, detail return, no horizontal overflow and 125% enlargement. Added duplicate-period and map-height assertions. Proportional-area/missing-value tests pass.
- Local Chromium passed; local WebKit dependencies could not install (apt sandbox setgroups failure). Required GitHub CI installs browser dependencies and must pass both engines on the final commit before promotion. Inspect its synthetic screenshots before reporting completion.
- No production database writes. Physical iPhone keyboard/Face ID/full PWA relaunch remain unverified.
- After branch CI: recheck main SHA, fast-forward only if unchanged, verify main CI/Pages and HTML/cache markers `2026-10-28-home-density-222` / `2026102801-222`.

Next: chart-touch audit and existing performance-to-detail return verification. Do not repeat home re-layout without new evidence; preserve BUILD220 Standing UI content priority.

CI follow-up: initial dependency download timed out; retry passed both-engine home and broad layout checks. Trend continuity still queried the removed duplicate label; changed those assertions to the actual aria-pressed period button, preserving latest-period/late-response and amount checks. Next final commit must pass the complete workflow. Local Korean-font map and 125% screenshots inspected. Return/MA Node checks also passed.
