# Build82 — Carry performance context into security review

Opening a held security from performance retains the selected P&L type, period,
security amount, and partial state in a compact detail heading. Current unrealized
remains acquisition-based and has no selected-period label. Loading, mismatched
periods, missing symbols and unknown amounts are not fabricated or zero-filled.
The context is view-only and is never sent as AI evidence or saved as a decision.

Detail opening resets its scroll. Close/backdrop invalidate in-flight detail work
and restore the originating page scroll and focus. Existing account, calculation,
AI, comparison and saved decision behavior is preserved; no server/data migration.

Validation: context isolation and period/type/partial/unknown/zero checks; mobile
performance -> held security -> close with matching amount and return position;
existing calculation and decision tests at 390/402/430px plus enlarged text and
keyboard fixtures. No owner authenticated/iPhone E2E or model call claimed.
