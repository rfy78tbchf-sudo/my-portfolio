# Build236 pending-detail return and first chart input — 2026-10-29 KST

Verified latest main decd65c9bfc048ea736d7265db41600b71befe9c and Build236. Final branchCI40796926181, mainCI40797736354 and Pages40797735740 passed. Live HTML/SW/version.json identify2026-10-29-loading-state-236 / my-portfolio-shell-2026102909-236. Continued work/performance-detail-render-234; no duplicate implementation or branch. This run changes only the isolated measurement/regression harness and records, not the app or deployed version.

## Scenario and conditions

The existing detail fixture now supports --pending-return. Gate ARM's core detail response after its request starts; return to the portfolio before it completes; open MRNA while ARM is still pending. When MRNA's overview/chart is available, emulate a chart tap and keyboard Home selection. Release ARM's old response, wait for request idleness and assert the active chart DOM instance, selected date and chart window remain unchanged. Verify return scroll/focus and no horizontal sheet overflow. Query filters isolate MRNA from the ARM saved-decision/history fixture. All account data is synthetic; every request is locally fulfilled/aborted; unexpected origins/writes are rejected.

Five fresh Chromium sessions, one scenario each,390x844 touch/mobile,CPU4x,365 positive price points/security, synthetic50ms API delay except the explicitly gated ARM detail, warmed portfolio data, service workers blocked. ARM has ten synthetic saved judgments/history records; MRNA has none. Timing includes browser automation/locator overhead and two rAF callbacks: not actual paint/INP, real-device touch, or server latency. Chart callback includes Playwright tap preparation; it is not isolated event-handler CPU. Keyboard Home then changes selection before the late response is released.

| Metric | Median (min–max) |
|---|---:|
| Return from pending ARM, ms |79.5(68.4–91.6)|
| MRNA overview readiness while ARM remains pending, ms |396.2(345.7–461.8)|
| First emulated chart tap callback, ms |97.1(94.1–111.3)|
| Total calls in scenario |11 in all five|
| ARM core security RPCs already started before release |4 in all five|

No before/after speed improvement is claimed: no app modification was selected. The late ARM response starts no further ARM security RPC or ARM history read, does not reopen its modal and does not replace MRNA's chart/selection. This demonstrates response-generation isolation in this bounded scenario, **not transport cancellation**. Four ARM core reads had already begun. No transfer-byte, heap, timer/listener retention or long-task metric was collected in this mode; there is no zero-leak/zero-long-task claim.

## Candidates

1. Abort old in-flight detail requests: not selected. MRNA becomes usable before ARM is released, so this experiment does not establish a blocking queue bottleneck. Actual bandwidth savings/server cancellation were not measured. Adding cancellation across shared auth/queue/refresh paths without that evidence is premature.
2. Suppress stale follow-up/history work: existing detail epoch guards already prevent it in all five observations; no duplicate fix.
3. Avoid active chart recreation after a stale response: no recreation observed and selection/window are stable; no change justified. Existing Build233 steady-state geometry reuse remains intact.

## Verification and handoff

--verify --pending-return runs six width/zoom cases per engine:390/402/430px ×100/125%, alternating browser Back and explicit return, then chart touch/keyboard selection and late-response checks. Local Chromium verification passed. The existing CI now includes this mode for Chromium/WebKit; check the final diagnostic commit's CI next run. Local WebKit still relies on CI-installed OS dependencies. No actual iPhone/Face ID/native keyboard/PWA termination test.

The full raw synthetic samples and corrected pending-mode conditions are recorded in PERFORMANCE_PENDING_DETAIL236.samples.json. The earlier preliminary probe omitted chart input and is not the reported five-session dataset.

Keep Build236/main unchanged; no promotion is intended for this diagnostic commit. The current delayed-core scenario has no reproducible defect or proven extra optimization. If continuing detail latency work, distinguish slow core response from slow saved-history/decision-review response; gate those later phases separately and verify active input/period/crosshair is retained. Do not infer a benefit from blanket cancellation, generic batching or another steady-state microbenchmark. Preserve freshness and saved-decision race protections.
