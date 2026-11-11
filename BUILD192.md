# Build192 — Keep edits made during save visible

Baseline: Build191, 3e053b0. Existing completion already shows decision, reason, checkpoint and return action. Found a real gap: a newer draft made while a save is in flight survived in draft storage, but successful readback always hid the form and showed the completion action. This could imply the latest visible edits were saved.

After verified readback, if the decision form has a newer dirty version, keep it open and explain that the submitted version was saved while subsequent edits remain a draft. Do not show the completed-and-return action. Existing verified summary records the actual saved version. A second explicit save is required for new edits; ordinary unchanged saves retain existing completion flow.

Tests: extended delayed-save unit case asserts exact persisted reason/condition versus new draft and visible form; mobile delayed lost-response fixture edits during save, checks one write, no completion action, unchanged saved version, screenshots notice, then explicitly saves newer version.

Verification complete: 51 local unit tests passed. GitHub Actions run 38116320012 passed the full Chromium mobile suite at 390/402/430px and focused WebKit return checks. Inspected the 390px delayed-save screenshot: draft notice, enabled explicit save and open form remain visible without a completion-return action. All writes used synthetic fixtures, with no real account writes.

Production index.html matches implementation fb278709211c5cb47dbc35b9f64d359a9b0ee416 (SHA256 4ec81cd756454ac49f9e8f775fc99db12ae150a38a35df51d3e4511408f93794). This verifies deployed code, not authenticated real-account behavior. Real iPhone standalone/background return and the 30-second/one-minute daily-use targets remain unverified.

Next priority: validate the saved latest decision and checkpoint on a subsequent visit, including actual iPhone return behavior when available. Retain existing review links and draft recovery; do not rebuild completed flows.
