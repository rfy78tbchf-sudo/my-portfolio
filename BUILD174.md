# Build174 — Direct review conditions

Qualitative checkpoints such as “다음 실적 발표 때 확인” are valid saved conditions. Home and detail identify them as “직접 확인할 조건” and explain that the user must judge the condition against the relevant information. The input guidance and verified-save confirmation use the same distinction. Older records work immediately with their original text; no data migration or new monitoring service is introduced.

Exact supported dates, closing-price thresholds, and stored-close moving-average rules retain their existing evaluation. Empty conditions and standalone malformed date/price expressions still show validation guidance. Compound prose is never partially interpreted as a numeric trigger. Direct-review text never produces an automatic hit, including after missing/stale prices or failed refreshes. Independently verified relevant official evidence or confirmed quantity changes can still request review without claiming the user's condition has been fulfilled.

The existing immutable save/readback flow, Build171 comparison reset, Build172 weight display, and Build173 edit prefill remain. Home shows a bounded 80-character preview for a direct-review condition; detail and edit retain the full original text. No portfolio amounts or financial calculations are changed. The build marker and PWA shell cache are refreshed.

Coverage includes 70 dedicated parser/home/detail cases, three additional save/reopen/empty-input regressions, and mobile save/reopen assertions at the existing 390/402/430px widths. The mobile assertions are included for CI; they were not run locally because browser execution was unavailable under the existing restriction. See the task's verification report for the aggregate non-browser results and existing baseline failures.
