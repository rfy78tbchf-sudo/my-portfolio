# Build171 — Clear an optional comparison target

Clearing the target weight now removes the previous comparison and its linked AI opinion, so a user can save a plain hold, revisit or pause-addition decision without being asked to recalculate an intentionally removed comparison. The selected choice, written reason and review condition are preserved. A reduction decision still requires a current comparison and matching AI opinion; a zero-percent target remains a valid comparison.

In-flight comparison, refresh and AI responses cannot restore cleared comparison state. Decision readback checks use the actual submitted values so clearing the target during a save does not invalidate an otherwise correct saved receipt. Unrelated standalone AI opinions remain available.

The focused regression executes the production event handlers with isolated DOM and RPC doubles and covers 20 scenarios, including stale successes/errors and clearing during save. It is included in the existing mobile CI workflow. These tests make no production account or financial writes. Browser coverage is provided by the existing mobile CI suite; the focused regression is not a real-device test.

Updated the build marker and service-worker cache key so the existing app-update flow detects this release without clearing saved login or local preferences.
