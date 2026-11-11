# Build154 — current realized-profit coverage audit

2026-10-07 09:35–09:40 KST: authenticated owner-scoped THIS_MONTH RPC returned10 sale entries. Three domestic official entries plus SOXL two-sale closed cycle and SOXS one-sale closed cycle give6 entries included in KRW total (rounded616123). This is partial; new trades can change counts. SOXL/SOXS pending_count is now0 after ledger settlement and native cycle profits remain458.92/29.23USD.

Four remaining entries: ARM Oct5 18shares (direct same-day buy/sell sequence and earlier basis uncertainty), ARM Oct6 18shares awaiting Oct8 settlement and acquisition-cost allocation, MU Oct5 3shares (cost uncertainty carried from Sep22), MRNA Oct6 9shares awaiting Oct8 settlement and allocated basis. Pending alone does not prove settlement will resolve basis.

No matching ARM/MU realized_pnl_events exist. Read-only KB SPQM2206 query for Oct5 returned HTTP200 with no items and provider message that no overseas P&L records exist (request807). Existing KRW historical averages and current native averages do not establish the pre-sale USD basis. No source ledger amounts, order sequence, or profit were invented or overwritten.

First-priority diagnosis is narrowed, not fully resolved: official historical cost/realized statement or verified execution sequence is still required. UI now shows KRW-included sale count and, inside collapsed sale evidence, the originating unresolved trade date. Existing native USD display and partial totals remain unchanged. Regression checks verify count and date while retaining earlier cycle/official precedence tests.
