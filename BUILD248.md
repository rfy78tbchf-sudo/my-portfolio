# Build248 — skip superseded queued period calculations

## Evidence and change (2026-11-09)
Main/Pages remain 7f1e05d; existing work branch b520da8. Latest branch CI42542977034 failed at Playwright browser installation before UI tests; no application test failure was established. Backend247 and frontend245 were previously deployed.

Rapid 1W→1M→3M→6M→ALL navigation queued every expensive calculation serially, even after its result was obsolete. Add optional validity checks before the serialized request and again at the read queue slot. Only unstarted stale period/realized requests are skipped; running requests are not aborted, concurrency remains one, and ordinary RPC callers are unchanged. Reusing a queued period after returning to it remains valid. Refresh snapshot identity, auth epoch, day and realized-request epoch prevent obsolete reads. No calculation, currency, account or estimate definition changes.

## Validation
Node VM runs real production queue and period state functions with synthetic fixed 30ms service delay, seven runs each. Before median151.316ms (151.034–151.610); after60.745ms (60.484–61.650). Five requests become two. These are request-to-state timings, not browser paint or production network/DB timings. No CPU/network throttling was applied. Tests cover repeated selected period, rapid return to queued period, single active calculation, snapshot replacement, midnight, realized follow-up and partial/estimated output. Build131,209,72 and247 regression checks pass.

## Release gate and next action
Candidate only: require final branch CI including Chromium/WebKit and live version verification before main promotion. Browser installation is being retried locally. No production data written. Next measure cold/first and warm/repeated period selection with browser paint and realistic history sizes; independently profile DB/RPC latency. This change only eliminates obsolete queued work, not the duration of an already-running calculation. Preserve fixed asset goals and all finance evidence. No physical iPhone verification claimed.
