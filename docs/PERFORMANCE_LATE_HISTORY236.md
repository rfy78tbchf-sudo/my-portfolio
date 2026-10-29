# Build236 delayed history and decision reread — 2026-10-29 KST

Latest main decd65c9bfc048ea736d7265db41600b71befe9c / Build236, mainCI40797736354 and Pages40797735740 succeeded. Previous diagnostic daa9240c0726383ca02ea971f6916b8162b3d4b1 CI40800279481 succeeded. Live HTML/version.json2026-10-29-loading-state-236 and SWmy-portfolio-shell-2026102909-236 were rechecked. Continued work/performance-detail-render-234. No app change or release.

## Controlled scenario

Extend the existing isolated detail fixture with --late-history. Gate the shared ARM saved-analysis response after the overview is ready. Select the three-month chart period and Home crosshair point while the history is pending. Release history, let its ten entries appear, then gate the second get_investment_decisions response. Use the actual visible “지난 판단 이후 변화” action to reveal the saved review, then “내 결정 수정하기”; type synthetic reason/condition and select characters2–7 in the focused reason. Release the decision read. Assert chart DOM identity, period/window/point, draft text, focus and selection all survive. Return via visible close button or browser Back, preserving the originating row focus. Do not click hidden optional controls or the hidden footer return button during draft editing.

Five fresh Chromium sessions,390x844 touch/mobile,CPU4x, warmed portfolio,365 positive price points/security,ten ARM saved decisions and ten long synthetic AI analyses. All API responses have50ms synthetic delay plus explicitly controlled gates; every request locally fulfilled/aborted; SW blocked. No operating DB writes, no model calls. Browser HTTP caching is disabled by interception. This is neither cold startup nor real-server latency. No baseline-versus-change comparison because app code did not change.

| Callback/readiness measurement, ms | Median(min–max), n=5 |
|---|---:|
| Overview / history gate reached | 498.4(476.8–634.8) |
| 3-month period tap callback | 96.7(95.0–129.2) |
| History release to entries and next read gate | 126.2(110.5–130.6) |
| Decision reread release to idle | 98.1(83.3–103.0) |

All five attempts used8requests:four core RPCs,one shared history read,one breakout-rule read,one metrics read and a second/fresh decision read. No extra history fetch and no chart recreation. Callback timing includes Playwright preparation, locator checks and two rAF callbacks; not presented paint/INP, isolated handler CPU or actual iPhone touch. Gate-release measurements omit the deliberate pending interval and include polling/automation; they cannot be compared with the prior approximately5-second refresh report.

## Long-task attribution and candidates

Initial aggregate sampling found two long tasks in each attempt. A second five-session set (the committed raw samples) splits history, editor navigation/input, and decision refresh. CDP duration values in JSON are seconds; this table converts layout duration to milliseconds. Task phase is assigned by start time; intervals include assertions/automation. CPU/task durations are not additive parts of callback wall time.

| Phase | Layout ms median(min–max) | Long-task counts, five attempts |
|---|---:|---|
| history | 0.0(0.0–0.0) | [0, 0, 0, 0, 0] |
| editor | 167.7(138.3–171.6) | [2, 2, 2, 2, 2] |
| review | 10.2(8.8–10.9) | [0, 0, 0, 0, 0] |

The two long tasks belong to the editor navigation/input interval, not either late-response phase. Editor task durations were118/59,116/64,122/90,135/75,144/60ms across the five samples (see raw order). This is positive evidence for narrowing the next trace to optional-review expansion versus editor relocation; it is not evidence that the saved-history request itself blocks input. No whole-app zero-long-task, memory, listener/timer or byte claim.

Candidates (maximum three):
1. Suppress chart rebuild on late history/decision reads: already no rebuild; do not change.
2. Eliminate the second decision read: rejected because it checks fresh saved decisions after evidence; this run shows no duplicated history request and preserves input. Keep storage/race/freshness behavior.
3. Reduce editor navigation layout: reproducible work exists, but this interval combines optional-review expansion, editor relocation and typing. No speculative CSS containment or layout/flow redesign. Attribute the two event paths before selecting an implementation. Earlier hidden-history-body microbenchmarks do not by themselves establish savings here.

## Verification and continuation

Local Chromium --verify --late-history passed390/402/430px ×100/125% both before and after phase instrumentation. Final branch CI remains the Chromium/WebKit verification gate. The mode verifies amount fit, horizontal overflow, draft visibility, focus/selection, chart state and alternating close/browser Back. Existing broad mobile CI retains touch targets, bottom actions, saved-decision correctness and crosshair coverage. This new mode is included for both Chromium/WebKit. Local WebKit OS dependencies remain unavailable; rely on final CI, never claim actual iPhone/Face ID/native keyboard/full PWA restart testing.

Next run: verify final branch CI, then isolate the editor interval with trace marks for reveal saved review, edit form, and each text input. Do not repeat the now-passing delayed response checks as a new optimization. No deploy is intended for diagnostic-only changes; Build236 stays live. If no safe measurable improvement emerges, retain the app and avoid another unchanged-status notification. Separately, the requested complete-refresh latency remains distinct from these gate-controlled tests and must not be declared solved by them.
