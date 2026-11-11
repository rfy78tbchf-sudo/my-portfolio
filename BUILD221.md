# Build221 — 초안 보관 실패 시 입력 화면 유지

Baseline: main 51264042b05c919c3ed8fca527f6b1e178e96183 (Build220).

## Result

A failed local draft write previously displayed a warning but still allowed the detail sheet to close. The failed-retention warning is now brought into view and navigation stays in the editor. A discard action is available even for a first draft when retention fails; explicit confirmation remains required. Saving the judgment or recovering device storage permits normal navigation. Restoring an ordinary memory-only draft also retains the storage-failure warning instead of overwriting it with generic restoration text.

No automatic submission, changed request identity, account writes, financial calculations or extra normal-path explanatory text. Build220 Standing UI content priority remains applicable.

## Verification and handoff

- Focused Node checks: original request preservation, blocked leave, recovery with exact latest input, ordinary and pending memory-only restoration, and existing save/edit/race regressions.
- Extended synthetic Chromium/WebKit decision journey checks failed draft storage, visible warning, preserved input, zero extra writes, and successful close after storage recovers. Required branch CI must pass on the final commit before main promotion.
- Local browser execution unavailable because the Playwright browser executable is absent; use existing GitHub CI browser installation and suite. No production financial or judgment data is used.
- Latest main and Build220 CI/Pages succeeded at inspection. No open PR or active recent run; the unmerged performance-218 branch is an older October 23 alternative, not an active newer task.
- Remaining: financial source completeness described in Build219, and physical iPhone Face ID/native keyboard/full PWA termination checks. Do not claim those from browser tests. Do not invent further UI changes without evidence. Before promotion recheck main SHA; after promotion verify Pages and the 221 HTML/cache markers.
