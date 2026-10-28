# Build234 synthetic holding-count sensitivity — 2026-10-29 KST

Continued work/performance-detail-render-234 at001e9e9 (CI40760496175 passed). Main716448a and actual HTML/SW/manifest still identify Build234. No overlapping implementation found; no product code or deployment changed.

Added SYNTHETIC_HOLDINGS=4|20|50 to the existing refresh-interaction fixture. Additional names/ids are explicitly synthetic; no inference about the user's real holding count. Every level uses positive per-row values and positive daily price histories, a generated total from holdings plus synthetic cash, and locally intercepted APIs. Per-security price queries now return only that security's rows, honor limit and descending dates, avoiding an artificial N-squared payload from returning every security on every request. This changes the fixture even at4 holdings; do NOT compare these timings to older fixture results as an app improvement.

Five fresh Chromium sessions per size (15 total),390x844 CPU4x,50ms mocked reads,24 prices per security, SW blocked, warmed tab data. Each session runs the same four tab clicks idle and with refresh holdings gated, then verifies search/focus and synthetic updated total. Profiles include instrumentation/CDP overhead; two-rAF callback time is not presented paint/INP. This does not measure cold startup or real server/iPhone performance.

Portfolio transition median(range), ms:

| Holdings / state | Click through callbacks | HTML construction+assignment | CDP layout |
|---|---:|---:|---:|
| 4 / idle | 80.0 (73.0–87.0) | 10.3 (9.6–14.6) | 32.5 (27.4–45.4) |
| 4 / pending | 71.0 (64.0–93.0) | 8.9 (8.5–13.0) | 39.9 (28.3–42.9) |
| 20 / idle | 181.0 (164.0–219.0) | 31.4 (21.5–35.4) | 107.8 (99.8–145.4) |
| 20 / pending | 186.0 (153.0–205.0) | 27.2 (20.4–30.4) | 116.0 (105.4–134.6) |
| 50 / idle | 324.0 (274.0–360.0) | 44.9 (39.1–61.2) | 238.1 (191.9–267.9) |
| 50 / pending | 396.0 (332.0–469.0) | 56.0 (40.6–71.1) | 297.3 (252.9–368.6) |

The sampled growth is dominated by layout of additional rows, not evidence of explosive computation. This limited3-point experiment does not establish algorithmic complexity or an acceptable real-device latency target. Instrumented phases and CDP metrics overlap and must not be added. Idle/pending state order and caches can affect results.

All15 sessions retained one sync-current despite a repeat refresh click, preserved synthetic ARM search/focus after the delayed response, and displayed the updated synthetic total afterward. No heap/retained-DOM scaling claim is made because this harness did not collect those counters. Existing earlier bounded retention results apply only to their smaller fixtures.

Candidates: (1) offscreen row layout is now the strongest scaling candidate, but CSS content-visibility/virtualization is NOT selected without scroll geometry, search, accessibility and detail-return validation; an estimated row height could change the user's scroll position. (2) number/date formatting cache is lower priority because HTML cost grows less than layout and no dominant formatter is isolated. (3) more request sharing is not justified for warm navigation or pending refresh, where duplicates remain absent. No speculative implementation or performance gain claim.

Validation: the instrumented15-session assertions passed, and a separate50-holding default-mode Chromium verification was run. Existing CI verifies Chromium/WebKit at default4; preceding commit CI passed. A50-holding verification step is added for both engines. Check this diagnostic commit's CI at next start; no main promotion is intended. Local WebKit still needs CI-installed OS dependencies.

Handoff: if continuing the large-list candidate, first capture actual row geometry and scroll-return positions across390/402/430px and125%, then compare a reversible offscreen-rendering experiment at4 and50 rows with identical synthetic inputs. Include search for an initially offscreen symbol, keyboard accessibility and opening/returning from that symbol. Reject any improvement that increases layout shifts, loses focus/scroll, changes amount visibility or merely delays first interaction. Do not repeat unchanged small-fixture microbenchmarks or prior rejected scheduling/containment candidates without new evidence.
