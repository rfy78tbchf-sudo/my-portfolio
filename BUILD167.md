# Build167 — Preserve the return path

Add a bottom sticky return button to the detail sheet, using the existing unsaved-input confirmation and scroll/focus restoration. Keep expanded home sections when a saved decision causes a home redraw. Preserve portfolio controls and scroll when changing price display or sort order.

Build166 mobile CI failed because changing the price selector redrew and collapsed the controls before the next sorting action. This exposed a real interaction problem; preserve the menu in production rather than bypassing visibility in tests. Extend mobile checks for controls staying open and the bottom return action. Existing update, chart-recovery and refresh unit checks pass.
