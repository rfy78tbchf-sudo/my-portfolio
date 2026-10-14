# Build207 — Compact period performance summary

Compress the total-period header, tabs, summary spacing and gain/loss subtotals. Keep account scope, selected dates, calculation coverage and the explicit partial-result label visible. Show up to three valid nonzero KRW contributors ranked by absolute impact, independently of list filters. Foreign ticker symbols are preferred in these summary rows when recognizable; domestic names remain. Each row keeps its existing detail/evidence navigation.

No financial calculation, API request or data mutation changes. Unresolved, nonfinite and foreign-only values remain excluded from the KRW leader list. Other performance views and home layout remain unchanged.

Local evidence and return-navigation tests passed. Added ranking/label/scope regression checks and a three-contributor mobile screenshot/assertion above the bottom navigation to the existing browser suite. Physical-device review remains separate from automated browser checks.

Final verification: Mobile portfolio layout run 38564936180 passed both jobs, including Chromium/WebKit and three-contributor viewport assertions. Pages run 38564935288 succeeded. The 390px synthetic screenshot was inspected: selected period, partial label, total, gain/loss subtotals and three contributors fit above the navigation. During verification, an accidentally duplicated layout fixture inside the realized-tab test was removed; this was a test setup issue, not a runtime financial change.
