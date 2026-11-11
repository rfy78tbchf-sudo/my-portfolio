# Build108 — Today movement to full stock attribution

The home Today card now opens the existing stock-performance screen with Today and Total selected automatically. The complete list can be sorted by absolute impact, profit or loss. Unknown entries remain at the bottom; sorting copies the array and does not mutate the cached home source. Available stock data remains accessible even while account-wide P&L is awaiting comparable account observations.

Reuse today's home stock snapshot only when both period dates equal the current KST day. Invalidate any older pending stock-period request before reusing it. Otherwise clear the previous result and use the established period query, preserving its request/owner guards and failure handling. Today responses carrying different dates are rejected. No new backend endpoints, accounting calculations or database writes.

Tests cover resetting realized view to total, returning from older periods, late response protection, date rollover, failures/retry, missing values and all three orderings. Synthetic mobile checks at 390/402/430px cover account-waiting home -> today's complete list -> change sort -> stock chart -> return to the same day. No owner-authenticated phone run is claimed.
