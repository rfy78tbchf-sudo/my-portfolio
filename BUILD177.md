# Build177 — Resume decision drafts after reload

Baseline: e9b0771a4b197c433dd1928f752e0e5027ecab43 (Build176).

Decision inputs are now synchronously stored on input, scoped to the authenticated user subject and security ID. Reopening a holding after reload restores choice, reason, review condition and comparison inputs, explicitly marked as an unsaved draft. Comparison results and AI evidence require fresh calculation. No transaction, balance or server decision write occurs until Save.

Confirmed save, recovered matching receipt and explicit discard remove the durable draft. Request identity is persisted before submission to preserve unchanged retry identity after interrupted responses. Storage failure has a visible local warning; malformed data does not break detail. Drafts remain device/browser-local, not cross-device. Logout removes in-memory access; signing into the same account can restore local drafts. Other accounts use separate keys. Clearing browser data removes drafts.

Validation: 92 isolated assertions passed, including fresh-runtime recovery, owner isolation, discard, confirmed removal, interrupted request recovery and blocked/corrupt storage. Existing sync, dirty-state and scroll-return checks passed. Mobile fixture now reloads a real browser page at 390/402/430px and then restores and saves synthetic data only. Deployment and mobile CI results pending.

Actual signed-in iPhone/PWA process termination and real-user completion remain 확인 필요. No daily 30-second/one-minute usability claim. Next priority is home revisit context and stale-data visibility, after mobile recovery verification.
