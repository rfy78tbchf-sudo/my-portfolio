# Build282 — monthly source dates and verification limits

The monthly RPC already returns stored source timestamps, but the UI discarded them and showed only a completed-record label. Calendar finalization does not establish position identity, quantity reconciliation, account identity or whole-account financial verification.

Monthly rows now show the stored primary-account and ISA timestamps in KST, distinguish saved/calendar-closed from same-day updating, and state that financial verification requires separate confirmation. Missing/invalid timestamps remain unknown; they are not replaced with the record date or current date. An older ISA observation is neither relabelled nor described as a loss. No monthly amount, source, finalization, plan baseline or collector is changed.

Independent synthetic tests cover different source dates, KST midnight, missing/malformed timestamps, finalization without verification and immutable inputs. Existing wealth/projection/annual/update tests pass locally. The existing Chromium/WebKit journey now asserts the source dates and verification text at 390/402/430px and zoom. Local browser binaries are absent; CI is required before rollout. Physical iPhone and actual-user login remain unverified.

Correction review: the collector excludes finalized rows. Source-level account-total corrections exist, but there is no monthly revision table/function found in the inspected schema. The historical source resolver also applies its recording-time cutoff. Therefore later evidence corrections do not automatically revise a closed monthly record. A future append-only monthly amendment needs original-row linkage, source identities, effective and received times, reason, idempotent request identity and separately authorized application. Preserve the original closed row; never replace historical sources with later balances. No amendment mechanism or historical amendment is deployed in this build.

Whole-account A/B, native cash/FX evidence, ISA opening evidence and external-flow completeness remain incomplete. This display change does not resolve or alter their amounts.
