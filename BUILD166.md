# Build166 — Direct access to holding reasons and decisions

Add three compact shortcuts above the stock detail chart: holdings, holding reason, and the latest decision. Existing sections remain in place; shortcuts open collapsed ancestors, scroll and focus the destination. When no decision exists, the decision shortcut opens the existing entry form. No analysis or saving runs automatically.

Remove shortcuts before changing security or opening a sale review so stale actions cannot remain. The decision label updates after saving. Chart-only recovery leaves shortcuts and draft fields intact.

Validation: mobile fixture checks all three destinations, collapsed-section expansion and focus; existing chart recovery and app-update tests pass locally. Full mobile CI covers the existing decision flow.
