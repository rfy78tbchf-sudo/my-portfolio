# Build169 — Remember chart preferences

Remember the selected stock-chart period and moving-average checkboxes on this device. Reopening a detail reads validated preferences; navigating between stocks keeps the existing shared settings. Only UI preferences are stored, with no holdings, prices, notes or account identifiers. No-MA selection is preserved. Invalid or inaccessible storage safely uses the original all/20/60 defaults. Pinch/pan positions are not carried between securities.

Validation covers round-trip storage, supported periods/MA values, disabled storage, malformed values and empty MA selection. Mobile regression selects three months, closes the detail, and verifies that the reopened chart restores that period.
