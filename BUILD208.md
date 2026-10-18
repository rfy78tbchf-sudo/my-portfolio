# Build208 — Identify the list return destination

Preserve existing search, scope, period, sort and scroll behavior. After closing a security detail, briefly mark the originating row with a subtle teal background and inset edge for 2.4 seconds, without changing layout or scrolling. Reopening clears the marker. Replaced DOM rows are resolved by the existing identity lookup; hidden destinations are skipped.

Touch activation of holding/analysis cards now explicitly focuses the origin before opening detail, so mobile browsers do not accidentally remember an unrelated input. Restored noninteractive cards get tabindex=-1 for programmatic focus without adding a tab stop.

Six targeted Node regression files passed, covering return identity, marker lifecycle, browser history, unsaved input protection, contribution filters and existing next actions. The existing mobile browser suite now asserts the returned contributor is marked after a background rerender. No financial calculations or data writes changed. Physical iPhone behavior remains a separate check.
