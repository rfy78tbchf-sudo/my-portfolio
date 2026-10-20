# Build214 — Home asset map, portfolio-led decisions

User direction supersedes Build213's B recommendation: A is preferred; home is an overview and security review starts by choosing a security in the portfolio tab.

Base: `ccbe1fdd5e116793e36489204859e8610a995ffa` (latest main checked before editing).
Build marker: `2026-10-20-asset-map-214`.

- Home tab label restored to 홈. Asset → trend → composition; no review queue, next security, saved-decision summary, or price-watch card on home.
- Removed unused home queue and cursor code. Existing drafts and saved records are not changed or deleted.
- Composition is a proportional rectangular map plus readable amounts/weights. Aggregate same security across accounts. Missing or invalid valuation is unknown, not zero. Use current displayed total; when known positions exceed total, label confirmed-stock-only denominator. Residual includes timing/valuation differences and is not called cash. Map does not open decision forms.
- Portfolio link preserves existing account/market/search settings. Portfolio list retains selected-security detail, comparison, save/retry, drafts and list return. Existing saved review/price alerts now follow the portfolio list. Review record loading/retry still uses existing APIs and owner guards.
- Financial calculation, P&L coverage, receipt verification and authentication unchanged. Existing browser fixtures now navigate through portfolio; receipt/content/duplicate-save assertions remain.
- Comparisons: `docs/ui214-review.html`, same synthetic data/period/390px. Previous three prototypes retained; selected direction updated. No private account data or memos in public artifacts.

Validation: asset-map accounting/area/missing data tests; Chromium/WebKit startup/layout at 390/402/430 and 125%; daily journey, trend continuity, detail controls and exact persisted decision/manual/comparison/retry browser tests. Existing mobile and decision regression workflow retained and updated for navigation. See GitHub Actions for final commit results.

No real account test writes or orders. Not tested on physical iPhone; Face ID, home-screen app reopening and native keyboard remain physical-device checks.
