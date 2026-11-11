# Build191 — Carry the home review reason into decision entry

Baseline: a2a34a5 (Build190).

Home review previously passed only a boolean to open saved judgment review. Carry its displayed reason and exact security/decision identity into the detail session. Show the reason above the saved review and inside the opened decision form, labeled as the reason seen on home. If the latest saved decision differs or cannot be read, replace the old trigger text with a changed/missing-record explanation. Never populate or save the user reason from this context; next-stock navigation starts without it.

Verification completed:
- Source/security/decision guards, escaping and changed/missing latest record tests passed. All 51 existing edit/draft tests passed.
- Full workflow 38111989146 passed on 2c88e003ff21ad66140373763c585fb41390d9a8, including Chromium 390/402/430px context continuity assertions, save/revisit suite and WebKit return checks.
- Inspected review-entry-context-390.png: label and original home reason readable above decision form. Earlier element capture overlapped sticky heading; centered the test capture to inspect the actual notice. Product behavior unchanged by capture followups.
- Served production HTML matches SHA256 34a349618b79e31ed74023265ba863f81055b2ac57cf78e3e55276a7220e3965.
- Synthetic test data only, no live-account records. Actual signed-in iPhone daily use remains confirmation-needed.

Next priority: reduce remaining effort from decision choice to a clear save outcome and next checkpoint, starting from current flow rather than adding analysis features.
