# Build152 — reconcile ticker/ISIN execution coverage

Period results for sold positions may use ISIN as the display symbol while execution evidence and realized rows use a ticker. The flat-position calculation now joins against the period result's verified aliases for active executions, sale coverage, opening ledger quantity and cash reconciliation. The UI keeps the ticker from underlying sales and retains their dates/quantities in details. No transactions are changed.

Authenticated live result on October6: SOXS USD29.23 from purchase4224.42 and sale4253.65, quantity140 each, zero opening/ending quantity. Previous SOXL458.92 remains. Both are labelled pre-settlement calculations. Calculated sale coverage becomes4 of8, with partial KRW amount823062 after including domestic official155770. This is not a complete month total.

Read-only worker audit of October sources: SWQA2301 32 rows, SPQM2205 21 rows, SPQM2207 zero rows, SSQM2442 3 rows and no SK/MU/ARM matches. Verified SSQM2442 date parameters against the official KB JSON specification download. ARM/MU historical snapshots carry KRW average cost despite USD currency; do not treat those numbers as USD cost or recover acquisition FX by dividing by current FX. ARM current native average exists but is not evidence of pre-sale average. Remaining4 sales still need reliable pre-sale basis/cost evidence.

Regression checks alias replacement, native ticker, no duplication, retained prior coverage and provisional labels. Authenticated production RPC returned both cycles.

## Official domestic date correction

A further direct match found the SK sale on broker trade date September29, not October1 settlement. Extended the existing service-only date linker with unique domestic report/ledger pairs matched by account, security, ISIN, quantity, price and gross amount, report cash-profit identity and date within7days. Known dates are never overwritten; cash and fees unchanged. Service invocation linked161 previously unknown dates. This is the same existing sync entry point, so future domestic evidence is linked automatically. Verify month count and September29 official profit after linking; earlier8-entry coverage in this note describes pre-link state.

Verified after linking: THIS_MONTH contains7 sales with4 calculated and3 awaiting reliable basis (ARM2, MU1). The partial amount remains KRW823062. The1M result correctly places SK on September29 with official profit KRW-4344. Mobile regression workflow37439622745 and Pages workflow37439621656 both passed.
