# Build193 — Preserve saved judgment identity after reloading

Baseline: main 260d2e5 / Build192. Review of the actual home reload path found that investment_decisions selected reason and checkpoint but omitted id. Build191's home-to-detail identity guard therefore incorrectly reported a changed judgment after a fresh fetch, even when the record was unchanged. Direct in-memory fixtures had hidden the missing API field.

Added id to the existing authenticated home query. No schema, permissions, calculation, or write-path changes. Home context continues into the same saved decision, while genuinely different decision IDs still produce the existing changed-record notice.

Regression test uses the production query and returns only selected columns. Reproduced failure on baseline (undefined identity); corrected query passes fresh visits, reason/checkpoint preservation, changed-ID protection, and retained confirmed identity on failed refresh. Mobile review journey now reloads through the real loader with selected-column responses before tapping home review and continuing the decision.

Local regression tests passed. Mobile CI, deployed-code match and visual inspection pending. Synthetic data only; authenticated physical iPhone revisit remains confirmation needed. Next priority is real-device daily return validation, including current saved reason/checkpoint and quiet-day completion; do not repeat completed UI work.
