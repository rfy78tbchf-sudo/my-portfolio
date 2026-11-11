# Build 74 — choose, compare when needed, record

Goal: brokerage for orders only; understand holdings and complete decisions in the app.

- Deferred the Build73 KB overseas net-profit API empty-response issue at the user's request; no new investigation or ledger changes.
- First-time decision: direct entry for hold/defer without requiring AI or a target weight.
- Reduction choice: show comparison prerequisite immediately, with a route to the existing quantity comparison / matching AI action. Draft reason remains intact when switching sections.
- AI response: primary action records the decision; optional sale calculation is secondary.
- After verified save, close the form and focus the saved decision summary.
- Existing comparison integrity checks, authentication, model invocation and server save logic preserved.

Validation: production HTML with isolated deterministic data, 390/402/430px, 125% enlargement and simulated keyboard. Direct-entry and reduction navigation preserve the draft. Build63/65 regression assertions pass. No real owner record or actual model call used for this UI test. Physical iPhone verification remains separate.
