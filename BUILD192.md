# Build192 — Keep edits made during save visible

Baseline: Build191, 3e053b0. Existing completion already shows decision, reason, checkpoint and return action. Found a real gap: a newer draft made while a save is in flight survived in draft storage, but successful readback always hid the form and showed the completion action. This could imply the latest visible edits were saved.

After verified readback, if the decision form has a newer dirty version, keep it open and explain that the submitted version was saved while subsequent edits remain a draft. Do not show the completed-and-return action. Existing verified summary records the actual saved version. A second explicit save is required for new edits; ordinary unchanged saves retain existing completion flow.

Tests: extend delayed-save unit case to assert exact persisted reason/condition versus new draft and visible form; mobile delayed lost-response fixture edits during save, checks one write, no completion action, unchanged saved version, screenshots notice, then explicitly saves newer version. Validation pending; no real account writes.
