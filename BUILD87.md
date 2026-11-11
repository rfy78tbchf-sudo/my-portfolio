# Build87 — All holding weights on Analysis

Replace the maximum-position-only presentation with a donut, descending list of
all currently held securities (weight and KRW value), and proportional row bars.
Default uses the existing risk card's total-assets denominator. A toggle compares
known security values alone. Aggregate the same security across accounts using
live_holding_display_basis, the valuation source used by My Holdings.

The donut groups positions after the top five; the list shows every security.
The total-assets remainder is explicitly other assets/valuation difference, never
assumed cash. Missing position values remain unknown; an invalid or undersized
asset denominator falls back to known holdings with an explicit label. Keep risk
metrics collapsed below the allocation and link each security to existing detail.

Validation: aggregation, denominator switching, residual and missing-value unit
checks. Existing mobile fixture exercises analysis at 390/402/430px, 125% text,
all rows, navigation and both scopes. GitHub Actions runs browser validation;
local Chromium is unavailable. No authenticated owner-account E2E claim.
