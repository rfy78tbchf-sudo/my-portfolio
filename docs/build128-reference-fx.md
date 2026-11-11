# Build128 — separately labelled whole-history reference conversion

Native-currency P&L can be verified while historical execution dates remain unavailable. A spot-rate conversion of aggregate USD P&L would erase historical exchange-rate effects; assigning invented execution dates would misrepresent the evidence.

The ALL-period RPC now adds optional reference-only KRW fields for the already validated local-only rows. It uses verified execution/order dates when present, otherwise the actual ledger recording date for settled trades. Dividend/tax/fractional cash uses its event date; pending cash uses the existing verified order-date evidence. Each event obtains a positive daily reference rate on or before its date, at most seven calendar days old. Remaining holdings use the same-cutoff valuation FX. No actual conversion trade or exchange rate is invented.

Reference conversion is emitted only when every event has FX, ending valuation has valid FX when needed, and the independent cash-event sum plus ending valuation matches the existing native-currency P&L to less than half a cent. Corporate members are combined through existing verified identifiers. Original P&L, reasons, currencies, counts and tax fields remain unchanged. Separate KRW recapture is excluded from each foreign reference field and added once to the overall reference total.

The UI keeps original currency results. A collapsed “전체 원화 참고치 보기” appears only when every displayed item is covered by either the existing KRW calculation or the new reference conversion. Expanded content states the date fallback, pending status and distinction from exact execution-date/actual-conversion P&L. Reference values also appear in row details. Other period behavior is unchanged.

Validation: eleven synthetic database cases cover cash mismatch, duplicate events, missing/future/stale FX, invalid ending FX, holdings, tax and zero native P&L. UI tests cover completeness, separate tax once, invalid amounts and preservation of existing totals. Owner-scoped comparison found no changed pre-existing row fields. The mobile suite opens the reference panel, checks the expected synthetic total and verifies narrow-screen overflow.
