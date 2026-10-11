# Build191 — Carry the home review reason into decision entry

Baseline: a2a34a5 (Build190).

Home review previously passed only a boolean to open saved judgment review. Carry its displayed reason and exact security/decision identity into the detail session. Show the reason above the saved review and inside the opened decision form, labeled as the reason seen on home. If the latest saved decision differs or cannot be read, replace the old trigger text with a changed/missing-record explanation. Never populate or save the user reason from this context; next-stock navigation starts without it.

Verification pending: source/security/decision guards, escaping, unchanged saved reason, existing draft/edit handlers, mobile home→review→decision context continuity. No live account test records.
