# Build 54: realized sales and AI analysis history

## Shipped behavior

- The owner scoped `get_live_realized_sales(period,account)` RPC applies account moving average to every buy and sell since ledger inception. Buy costs enter cost basis; sale fees and taxes reduce net proceeds. It reports each sale with a status and transaction ID; `get_live_ledger_realized` is its grouping, not a second allocation engine.
- A broker order date linked from evidence takes precedence over a ledger posting date. Posting only is provisional; neither daily ledger sequence nor database insertion order supplies intraday execution order. Same day buy and sell blocks allocation for the affected security and downstream open position until a defensible zero quantity transition. Other securities remain available. Source invalid trades have their own status even on mixed days.
- `get_live_realized_sale_trace` exposes the owner scoped transaction chain with source IDs and costs. `get_live_realized_cycle_review` returns a conditional cash difference, only upgrades it to verified closed cycle P/L if independent opening and ending zero positions and transaction completeness are established. This result does not allocate individual sales.
- USD realized, latest stored USD/KRW rate reference, and historical per purchase/sale market rate KRW management estimate are separate fields. An absent historical rate yields null, never 1. Market FX is neither evidence of a conversion nor an official tax basis. Cash FX effects after a sale are outside stock P/L.
- Performance includes independent sale account/period controls, per security/per sale drilldown, and one month reconstruction inputs. An available subtotal is never presented as total account performance.
- AI uses an owner bound request ID throughout reservation, server calculation, model response, history write and reload. Concurrent duplicate requests do not invoke another model. A failed history write is shown separately from a failed model response. Scenario metrics continue to be computed on the server, with integer share feasibility for a target weight. The user's investment thesis remains owner authored and versioned.
- Migration order: `build54_realized_sales`, `build54b_realized_nontrade_cost_guard`, `build54c_sale_trace`, `build54d_ai_analysis_request`, `build54e_lifecycle_review`, `build54f_one_month_inputs`, `build54g_weight_share_constraint`, `build54h_mixed_source_guard`, `build54i_isa_correction`. Migrations preserve original broker payloads, observations and transactions. Edge Function must be deployed with JWT verification and frontend after it.

## Validation and open input

- Run the existing `tests/*.mjs` gates and `tests/build54_realized_ai_flow.mjs`; CI runs `tests/build54_mobile.mjs` in browser at 390/402/430 px and 125% zoom. The mock AI test verifies execution, history, replay, and write failure but is not an owner login or paid model call.
- Reproduce owner specific P/L privately with `get_live_realized_sales('1M')` and `get_live_realized_sale_trace` under the real account owner. Never copy account identifiers, balances, images, user thesis, or trace payloads into this public repository or CI artifacts.
- The mixed date execution order still needs broker timestamps or actual execution IDs; a candidate closed cycle cash difference remains provisional without broker observed zero holdings on both ends.
- Recent month NAV still needs a verified opening balance, opening cash, and missing security prices. Match external flow reflection dates and settlement links before publishing account TWR or month P/L.
- Actual owner model success, persisted user thesis, uploaded evidence round trip, and real iPhone rendering need an authenticated owner session and user authored input. A configured secret or a mocked response is not proof of a live model answer.
- Historical FX market estimates should be compared with broker official KRW basis if it becomes available; never label them official or tax results.
- An uploaded observation can be corrected by its owner through an append-only record; original image, capture time and amount are immutable. Same request ID is idempotent. New evidence on a later day should be registered as a new observation. The production owner has not yet executed an actual uploaded-image correction.

## Restore

- Frontend rollback: point `main` back to the last known good commit and wait for the Pages workflow. Edge rollback: restore the previous function version with JWT verification. These database changes add functions and an owner restricted request table and nullable history column; old frontend and v27 do not depend on them. Do not drop the additive database objects or original records during rollback.
