# Build248 — skip superseded queued period calculations

## Evidence and change (2026-11-09)
Main/Pages remain 7f1e05d; existing work branch b520da8. Latest branch CI42542977034 failed at Playwright browser installation before UI tests; no application test failure was established. Backend247 and frontend245 were previously deployed.

Rapid 1W→1M→3M→6M→ALL navigation queued every expensive calculation serially, even after its result was obsolete. Add optional validity checks before the serialized request and again at the read queue slot. Only unstarted stale period/realized requests are skipped; running requests are not aborted, concurrency remains one, and ordinary RPC callers are unchanged. Reusing a queued period after returning to it remains valid. Refresh snapshot identity, auth epoch, day and realized-request epoch prevent obsolete reads. No calculation, currency, account or estimate definition changes.

## Validation
Node VM runs real production queue and period state functions with synthetic fixed 30ms service delay, seven runs each. Before median151.316ms (151.034–151.610); after60.745ms (60.484–61.650). Five requests become two. These are request-to-state timings, not browser paint or production network/DB timings. No CPU/network throttling was applied. Tests cover repeated selected period, rapid return to queued period, single active calculation, snapshot replacement, midnight, realized follow-up and partial/estimated output. Build131,209,72 and247 regression checks pass.

## Release gate and next action
Candidate only: require final branch CI including Chromium/WebKit and live version verification before main promotion. Browser installation is being retried locally. No production data written. Next measure cold/first and warm/repeated period selection with browser paint and realistic history sizes; independently profile DB/RPC latency. This change only eliminates obsolete queued work, not the duration of an already-running calculation. Preserve fixed asset goals and all finance evidence. No physical iPhone verification claimed.

## Verification handoff
Candidate c45446c pushed to the existing branch. Chromium actual-page average/confirmed/unknown display, touch disclosures and amount overflow checks passed at 390/402/430px and100/125%. Local browser downloads succeeded via fallback host; WebKit launch dependencies remain unavailable. Standard Playwright install-deps failed because the container cannot setgroups/setegid/seteuid for apt. Candidate CI42545934750 repeats the browser installation failure before UI tests; decision-regression job passed. No required checks were bypassed and main was not promoted. CI logs endpoint is not supported by the connected fetch tool, so its specific install error remains unconfirmed. Next resume this candidate rather than duplicate it: obtain CI installation diagnostic, restore required browser checks, add full browser period-switch latency coverage (Node baseline is not paint timing), and only then promote and verify live248. Existing live version remains245/backend247.

## CI installation diagnosis (2026-11-09)
The dedicated GitHub job-log connector retrieved job128931124974. ubuntu-latest moved to Ubuntu26.04.1; Playwright1.55.1 explicitly reports it cannot install dependencies or Chromium for ubuntu26.04-x64. Pin only the mobile runner to ubuntu-24.04, retaining the exact browser versions, all tests and release gates. This is independent of the local apt permission limitation. No test is removed or bypassed.

## Rendered comparison
Chromium390x844, seven fresh pages per version, fixed synthetic100ms service delay, no CPU throttling; real period renderer and real RPC queues, isolated synthetic session. From request start through two animation frames: before median523.2ms (520.1–531.8), after223.7ms (222.3–228.1). Five network calls become two; current ALL amount17 and partial status preserved; repeated selected period makes zero requests. This isolates rapid navigation queue cost and is not a production DB latency claim. New browser test runs both engines in CI. Cold isolated queries, large-history DB profiling and actual iPhone timing remain separate follow-ups.
