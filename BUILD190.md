# Build190 — Visible home asset basis during normal and failed loads

Baseline: 4af4d41 (Build189). Scope: home freshness readability.

The main asset observation dates were hidden in account details. The period-error/period-loading early branch also omitted existing account refresh failure and retry status. Replace the existing basis summary with visible KB/ISA observation timestamps in KST, including year. Timestamp sources follow the displayed total: account-scope observations for scoped totals, snapshot timestamp/date otherwise. Missing/invalid timestamps remain unknown; date-only snapshots do not invent a time. Preserve account failure/retry and dates in the period fallback while retaining confirmed assets.

No new card or financial calculations. Tests cover source selection, KST/year, missing dates, visible collapsed-summary timestamps and simultaneous account/period failure with unchanged assets. Verification completed:
- Full workflow 38110118297 passed on aaa21e72edc54f389a5b1516c495b532ce544f6d: Chromium 390/402/430px and WebKit account/period return checks.
- New simultaneous account/period failure assertions preserve confirmed total, visible basis dates and account retry; normal dates remain visible with disclosure closed. Existing priority-review first-screen geometry passed.
- Inspected home-basis-390 and home-basis-failure-390 screenshots: timestamp line readable without horizontal overflow; failure retains total and retry controls.
- Prior runs exposed isolated test extracts missing the new formatter dependency; adjusted the home fixture extraction boundaries, not their financial assertions.
- Production HTML SHA256 matches implementation: 32a259ac06e86a8b1bf6afe28224defe0c2ea630ea4edc5525089e62ade864ee.
- Synthetic test records only. Actual signed-in iPhone, live API latency and daily 30-second/one-minute usability remain unverified.

Next priority: inspect whether a highlighted home change preserves its reason through stock evidence and decision entry; keep working flows and avoid rebuilding them.
