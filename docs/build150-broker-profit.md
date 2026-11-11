# Build150 — useful realized-profit display

Connect independently reconciled KB SSQM2442 sale profit to the realized-sales RPC. Buy rows (02) are excluded. Require unique daily sale report, positive buy/sale amounts and quantity, date/symbol consistency, price/quantity tolerance and sell minus buy minus fee/tax equals reported profit. Replace same-date ledger rows only with matching total quantity; reject ambiguous or later ledger matches. Official reports cannot be replaced by closed-period estimates. Reviews accept owned broker sale evidence.

Live authenticated result: 8 sale entries, including KODEX 0173Y0 200 shares on October6, KRW155770 net profit, KRW2250000 acquisition amount. Previous 7 transactions retain unresolved status. This is a partial amount, not the total month's realized profit.

Native USD profit displays without requiring historical FX; KRW aggregate stays separately based on available KRW figures. Foreign rows use ticker names. Return rate is shown only with complete known local profit and acquisition amount. Review controls are in collapsed row details.

Verified pure regression for native currency, official priority, missing data, render, and review. Existing foreign broker-day path historically returns no profit data; no arbitrary trade order or costs introduced. No claim that all realized-profit gaps are fixed.
