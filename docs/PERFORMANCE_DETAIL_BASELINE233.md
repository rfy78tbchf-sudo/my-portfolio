# Detail runtime baseline after Build233 — measurement complete, no release

Status: completed measurement-only branch. No production change, no pending deployment and no new Build234. Do not treat this branch as an unfinished app implementation or rerun the same baseline without a new question. Operating app remains Build233.

Baseline main: f74321e3280696e0995e34a348694ed7f1a00fbb. Main CI 40673688435 and Pages 40673687477 passed. Main and work/performance-build233-chart-window were identical; no newer work was found. HTML, SW and version.json live markers were checked separately.

## Measurement
`node tests/detail_runtime_baseline.mjs` runs five new Chromium sessions, each opening/closing the same synthetic held security five times. 390x844 touch viewport, CPU4x, 50ms synthetic API response delay, real login/read queue/render paths; service worker blocked. All financial rows and login tokens are synthetic. UI_SOURCE can select a different source for controlled comparisons.

Readiness is overview availability followed by two animation-frame callbacks; it is not an actual presented frame or real iPhone latency. DOM/event listener counters are taken after forced collection on return. Direct detail queries remain fresh; this fixture has no saved decisions, so it does not cover a large judgment history.

- First entry (5 samples): 521ms median, 498–592ms.
- Repeated entry (20 samples): 343.0ms median, 300–555ms.
- Every visit: 7 reads (detail, activity, thesis, decisions, analysis history, breakout rules, decision metrics).
- Every post-return sample: documents 2, DOM nodes 1,370, event listeners 138. No increasing retention in this fixture; full heap/timer retention was not measured.
- Existing refresh harness rerun (3 samples, ordinary reads 40ms, valuation 180ms, reconciliation 250ms): confirmed asset median 42ms; trend/full home completion 513ms; 17 reads. Not a live KB response measurement.

## Candidates and decision
1. Cache repeated detail reads: deferred. The request list alone does not establish redundant reads; price, thesis and decisions must remain current, and failure/retry/owner changes are significant. No proven safe invalidation scheme or measured production cost yet.
2. Defer three secondary reads: dependency audit required. Analysis history, breakout rules and metrics participate in comparison/review UI; do not blindly defer them because an accordion is closed.
3. Cleanup retained nodes/listeners: no growth observed across 25 entries, so no cleanup rewrite is justified by this sample.

No implementation was selected. The numbers are a baseline, not an optimization result. No layout or financial/cache behavior changed; no new deployment is needed for this measurement-only record.

## Next concrete work
Instrument the synchronous detail rendering block separately from the four core request completions, and identify which secondary results feed the visible saved-judgment summary. Add a saved-decision/long-price fixture before choosing staged rendering or request deferral. Preserve freshness and never claim improved performance from the first-versus-repeat difference above. Continue from latest main, using this completed baseline branch as reference rather than creating another identical measurement branch.

Actual iPhone, Face ID, native keyboard, PWA relaunch and production latency remain untested. Do not ask for those before independently testing a new measured candidate.

## Raw samples
```json
{
  "conditions": "5 fresh Chromium sessions x5 same-security entry/return; 390x844 CPU4x; synthetic 50ms API responses; actual login/render/request queue; SW blocked; readiness includes two rAF callbacks, not actual presented paint; forced GC after return",
  "samples": [
    {
      "run": 1,
      "entries": [
        {
          "visit": 1,
          "readyMs": 542,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 2,
          "readyMs": 321,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 3,
          "readyMs": 315,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 4,
          "readyMs": 313,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 5,
          "readyMs": 319,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        }
      ]
    },
    {
      "run": 2,
      "entries": [
        {
          "visit": 1,
          "readyMs": 508,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 2,
          "readyMs": 326,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 3,
          "readyMs": 555,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 4,
          "readyMs": 300,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 5,
          "readyMs": 449,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        }
      ]
    },
    {
      "run": 3,
      "entries": [
        {
          "visit": 1,
          "readyMs": 521,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 2,
          "readyMs": 397,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 3,
          "readyMs": 344,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 4,
          "readyMs": 364,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 5,
          "readyMs": 364,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "investment_breakout_rules"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        }
      ]
    },
    {
      "run": 4,
      "entries": [
        {
          "visit": 1,
          "readyMs": 498,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 2,
          "readyMs": 342,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 3,
          "readyMs": 311,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 4,
          "readyMs": 329,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 5,
          "readyMs": 319,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        }
      ]
    },
    {
      "run": 5,
      "entries": [
        {
          "visit": 1,
          "readyMs": 592,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 2,
          "readyMs": 472,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 3,
          "readyMs": 398,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 4,
          "readyMs": 396,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        },
        {
          "visit": 5,
          "readyMs": 497,
          "requests": 7,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics"
          ],
          "documents": 2,
          "nodes": 1370,
          "jsEventListeners": 138
        }
      ]
    }
  ]
}
```
