# Build155 — core account first paint

Initial load now fetches accounts, securities, holdings, account snapshots and display/settlement/account-scope inputs first. Once core inputs settle the live account is rendered, before cash-flow reconciliation, settings and secondary analysis complete. These eight results are reused rather than fetched twice. Missing profit remains unavailable. The load promise stays single-flight until enrichment finishes.

Enrichment merges into the same object, preserving on-demand stock calculation state and realized-sale queries. Period-dependent fields from an obsolete period are skipped and the selected period is refreshed. Auth/load epochs suppress stale publication after logout/new login. Token refresh itself does not invalidate the load. Core failure preserves the previous account view and reports failure; secondary failure preserves the new core view.

Synthetic regression blocks reconciliation and confirms core rendering precedes completion, verifies stable target identity, and verifies logout blocks delayed core publication. Existing recovery and realized-profit regressions pass. No real-device latency claim is made; first paint still depends on the core queries settling. No DB schema or authorization changes.
