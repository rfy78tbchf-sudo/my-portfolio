# Build172 — Show current weight beside the target

The optional sell comparison now shows the selected security’s current percentage beside the target-weight input, together with the server-provided valuation basis. Initial details read `get_live_decision_metrics`, using the same `app_display_assets` denominator as the comparison. A successful comparison or current-holding refresh updates the displayed percentage from that response.

Missing, mismatched, invalid or unavailable metrics display a neutral dash rather than an invented zero. A valid zero remains visible. The server-provided basis label is escaped, and the display does not depend on the current account filter. The existing Build171 target-clear and stale-response protections remain intact.

Added 13 focused regression scenarios and mobile layout assertions for the current-weight display. The focused suite and the 20 Build171 regressions run in the existing mobile CI workflow. Tests use isolated data and do not write production account or financial records.

Updated the build marker and service-worker cache key so the existing app-update flow detects this release without clearing saved login or local preferences.
