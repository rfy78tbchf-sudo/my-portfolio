# Build170 — First decision end to end

## Problem found by following the user journey

A first-time direct-decision entry revealed the form but did not open its collapsed ancestor. Earlier mobile tests opened optional tools before pressing the direct entry, masking this failure. The decision start panel also followed the full chart and holding details, so users had to scroll to find the next action.

## Change

Put the existing start panel first, with a short saved holding-reason preview. Open the decision form directly in that visible panel from every decision-entry button. Keep form state and existing verification/duplicate protection. Place 7/30-day shortcuts before the free-form review condition and collapse advanced price/MA options. Explicit rule setup still opens and focuses them. Charts, holding data, full reasons, AI evidence and comparison tools remain accessible via existing shortcuts. No automatic decision, AI request or account write is introduced.

## Acceptance

Synthetic mobile journey on all tested widths: home holding → first decision without opening optional tools → user-written reason + explicit seven-day checkpoint → save/readback (including lost-response recovery) → return home → reopen saved judgment. Assert the exact reason and checkpoint, single write and re-review destination. Previous tests now assert the intentional first-action ordering. Existing save, follow-up, chart and update checks remain.

This release addresses the first-decision usability path. It does not claim real iPhone completion under a minute, production financial reconciliation, or live model validation. Existing period-P&L completeness and real-device usability still require separate evidence. No production decisions were created by the tests.
