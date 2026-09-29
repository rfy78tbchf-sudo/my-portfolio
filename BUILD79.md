# Build79 — Closed-period realized P&L

Add aggregate realized amounts for securities whose selected period begins and ends
with zero holdings. With all acquisition cash and sale proceeds accounted for, total
realized P&L is independent of intraday order. Do not invent per-sale allocations.

Eligibility: existing period quantity/corporate-event/source/FX checks; no pending
trades; raw API gross/net/fee/tax validation; matching raw trade count and net cash;
zero opening quantity independently accumulated from ledger including position events.
The realized API attaches closed_cycles only for the same owned primary KB account,
matching start/end dates, and matching sale-row coverage. Original items/statuses
are retained. ALL periods with different bounds do not receive this fallback.

UI replaces covered per-sale subtotal rows with the aggregate exactly once. It says
'기간 합계 계산'; missing individual allocations remain in the original evidence.
Native-currency and historical KRW totals stay separate. Dividends are excluded.
No owner ledger, holdings or decision mutations. No Edge Function deployment.

Read-only live audit identified 9 eligible securities covering 20 sale rows in the
current month. This is not 20 newly resolved individual allocations or a complete
portfolio reconciliation. Open positions, pending costs and unknown acquisition
bases remain outside this method. Domestic provisional ledger-date basis remains.

Validation: admissible-order permutation invariant; alias and double-count tests;
unknown FX/coverage rejection; original evidence preservation; 390/402/430px browser
fixtures, expanded text and existing decision/period regressions. No owner iPhone
or authenticated-owner end-to-end test claimed.
