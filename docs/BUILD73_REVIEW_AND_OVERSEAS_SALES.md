# Build 73 — review actions and recent overseas sales

## Verified on 2026-09-29 KST
- Prior main: 763a908 (Build72). No owner decisions or trade rows changed.
- Operational worker before change: version70; downloaded source equals repository source.
- SWQA2301 ledger lacks the four 2026-09-28 overseas sales. Separate active SPQM2205 evidence contains ARM7, SOXS500, MU2, MRNA20, settlement2026-09-30.
- SPQM2207 live audit returned zero rows. New SPQM2206 day query also returned `해외주식 매매손익 내역이 없습니다.` for 2026-09-28, both optional margin blank and documented foreign-margin2. This does not establish no trades or zero profit.
- User screenshot reports gross501426 KRW, costs163874, net337552. Not imported into ledger or treated as API data.
- Official KB specs downloaded from https://openapi.kbsec.com/api/kbs/guide/excel/b2c and JSON equivalent. SPQM2206 accepts order date; Record2 provides symbol, quantity and trade P&L. Requested currency2 is KRW and exchange basis2 is base rate.

## Changes
- Review panel: status, last choice, reason and user review condition; explanations folded. Primary action opens decision form preserving last choice, without auto-saving.
- Performance: separately dated overseas-sale section, live authenticated SPQM2206 query plus existing RLS pending evidence RPC. Pending sales appear even when broker P&L response is empty; never zero-filled or added to account return.
- New worker action remains behind existing user/internal authentication. It performs read-only KB queries and returns no credentials or account identity. Net P&L not inferred from ambiguously named summary fields.
- Response guards reject stale date, detached component and prior session/live object.

## Status
- UI and read-only query connection implemented; deterministic mobile and broker normalization tests included.
- Exact screenshot net337552 automatic retrieval: INCOMPLETE, broker API empty. Settlement evidence is available but cost basis/trade order must not be invented.
- No new schema, no trading endpoints, no model calls. Actual owner iPhone remains user verification.
