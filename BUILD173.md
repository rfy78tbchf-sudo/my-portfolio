# Build173 — Prefill saved decision edits

The explicit “내 결정 수정하기” action now starts with the latest saved choice, reason, and exact review condition. Initialization happens once per opened detail session, using the latest loaded history at click time. Generic new-decision and comparison entry points retain their existing behavior.

Existing drafts, choice-only edits, intentionally cleared fields, and edits made while a save or background refresh is pending are preserved. The four supported decision choices retain their existing meanings. Checkpoints are copied verbatim, including expired dates; this release does not change the separate “이 결정 유지하기” renewal semantics.

Saving still uses the existing immutable new-record flow, request identity and full readback verification. Prior AI or comparison evidence is never restored as current evidence. A saved reduction choice still requires a fresh executable comparison and current AI evidence before saving.

Added 30 focused handler regressions and 390/402/430px browser assertions to the mobile CI workflow. Tests use isolated DOM/RPC doubles and never write production financial records. Build171 comparison-reset and Build172 current-weight behavior is unchanged. The build marker and service-worker cache key are refreshed for the existing app-update flow.
