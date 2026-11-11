# Build146 — saved-decision follow-up

Continues approved step 4 after speed/sync and home review work. The home “지난 판단 이후 보기” action now opens the saved-decision review directly, expanding its containing details. Generic holding/chart links keep their usual entry point.

“이 결정 유지하기” prefills the prior choice, reason and review condition only into an untouched empty draft. A date condition due today or earlier is cleared so the owner chooses a new checkpoint. Price and other conditions remain editable for confirmation. Existing user edits, including an intentionally cleared form, are preserved. Prefilling marks the form as unsaved; no decision is saved until the owner submits and the existing server readback succeeds. Old decisions and comparison assumptions are not modified or copied into new calculations.

Synthetic tests cover expired/future/price conditions, original-record immutability and draft preservation. Mobile flow tests cover direct home-to-review navigation, prefill and retaining edited reasons at the existing viewport sizes. Existing home ordering, condition evaluation and script parsing regressions passed locally; CI checks the complete mobile suite.
