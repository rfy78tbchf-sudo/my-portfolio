# Build114 — Resume the agreed three priorities

The agreed priorities recovered from the September 30 conversation are:
1. Today's change: cash-flow-excluded account movement and contributing securities.
2. Compare holdings quickly: native-currency prices, unrealized P&L, weights and sorting.
3. Improve foreign average acquisition price: use broker-native prices instead of FX-derived averages.

Status at review: the home today journey and holdings sorting exist; native foreign price ingestion and detail rendering shipped in Build104. Read-only production inspection on October 1 found native evidence on all eight positive foreign holdings in the latest stored balance observation (12:10 UTC). This is stored source coverage, not a new broker refresh or a claim that all historical P&L is complete.

This change connects priorities 2 and 3: the holdings list offers Closing price / Average acquisition price selection in the existing guide row. The default stays Closing price. The average view uses validated native broker evidence for foreign holdings, with source, currency, quantity and observation-time checks. Missing evidence is shown as pending, never as a synthetic FX-derived average. Multi-account holdings link conceptually to account-specific detail instead of combining inconsistent observations. KRW holdings use the existing broker average. Accounting and order behavior are unchanged.

Validation: native-evidence rejection cases, multi-account and domestic cases; production-renderer mobile tests at 390/402/430px verify switching the visible price field and returning to closing prices alongside existing filter/sort/search tests. No credentials or account values are included in this document.
