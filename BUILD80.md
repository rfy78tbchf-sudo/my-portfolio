# Build80 — P&L clarity and dividend split

Keep the current acquisition-based unrealized tab and all existing P&L amounts.
Mark the realized headline and incomplete security subtotals as partial. Expose
specific missing cost, execution-order, transaction/cost, or FX evidence on demand.
Native and historical KRW P&L are explicitly labelled; opposite signs have an
expandable explanation. Never imply that absent broker amounts will arrive just
by waiting; distinguish unavailable amounts from failed requests and zero.

Split the existing period calculation's net dividend from the residual. Displayed
realized + net dividend + unseparated residual equals the displayed period total,
including rounding. Missing dividend is not zero. Residual remains unclassified;
it is not presented as proven valuation change. No extra database/Edge migrations,
no owner records changed, no additional realized trades claimed as resolved.

Broker date input/button use non-overlapping responsive columns. Tests cover
partial coverage, FX sign differences, unknown versus zero, dividend composition,
period mismatch, existing decision/period regressions, 390/402/430px, expanded
text and keyboard. Synthetic browser data only; no owner iPhone E2E claim.
Read-only live SQL reproduced the opposite native/KRW sign and existing dividend
component using the production calculation; it does not certify brokerage parity.
