# Build234 — Share the concurrent analysis-history read in saved detail

Baseline main Build233 f74321e3280696e0995e34a348694ed7f1a00fbb; main CI/Pages passed. Continued from the completed measurement branch 74a0cc7d0508e2ffaff8ff3bb2affa2627cad63e (CI 40678390069 passed); the branch contained only the previous baseline script/record. No overlapping app implementation was found.

## Dependency audit and selected change
1. Full history for previous opinions/comparison evidence and a simultaneous slim history read for official-evidence decision review select the same symbol/order/limit. Selected: while the full response is in flight, let the review consume that response too.
2. Blindly defer history/breakout/metrics: rejected. Previous opinions and comparison validation use the history, and review/conditions use rules/metrics. Hiding an accordion does not prove the data is unused.
3. Core rendering CPU: measured with a saved-decision/long-price fixture, but no rendering change selected yet.

The shared promise belongs to one detail invocation, clears after success or failure, and is not a completed-result cache. A standalone later review still makes the original slim request; reopening or requesting full history again reads fresh data. Failure handling and review/save generation guards remain. Decisions are still reread after the evidence read, preserving save-race protection. No DB changes or real user writes.

## Controlled samples
Five fresh Chromium sessions per version, 390x844 CPU4x, synthetic 50ms API responses, 365 price points, ten saved decisions, ten long analysis responses. Actual login/render/queue paths; SW blocked. All content is synthetic.

| Metric | Before | After |
|---|---:|---:|
| Analysis history requests per entry | 2 in all five | 1 in all five |
| Total detail reads | 9 in all five | 8 in all five |
| Overview readiness median (range) | 681ms (601–995) | 519ms (461–642) |
| Instrumented synchronous block median (range) | 347ms (231–498) | 238ms (231–265) |

Timing ranges overlap and the sync rendering algorithm is unchanged: do not attribute the CPU difference or claim a reliable latency gain from these samples. The deterministic gain is one duplicate request removed. Readiness includes selector observation and two animation callbacks, not a presented frame/INP. The sync mark covers the four-core-response handler through its initial renderDecisionHistory call, not every subsequent callback or the full detail lifecycle. These are not actual iPhone/server timings.

## Validation and next work
Local checks: new browser fixture verifies one history read with saved decisions, continued second decision read, and updated history on reopening. The sharing unit test verifies concurrency, no completed-result cache, failure clearing, retry and independent detail instances. Existing eight save/review race cases pass. Version consistency passes. Final CI runs Chromium/WebKit plus existing 390/402/430px, 125%, return navigation, chart and wealth regressions.

Keep main unchanged until final-commit required CI passes; then recheck main SHA and fast-forward. Verify deployed HTML/SW/version.json markers 2026-10-28-detail-reads-234 and 2026102813-234.

Next: separately measure hidden history-body rendering and core forced layout in this larger fixture before changing rendering. Keep the existing request freshness and decision-generation protections. The earlier isolated retention result was bounded; no whole-app heap/timer or real iPhone/PWA/Face ID/native-keyboard claim.

### Before samples
```json
{
  "conditions": "5 fresh Chromium sessions x1 detail entry; 365 prices, 10 saved decisions, 10 long AI histories; 390x844 CPU4x; synthetic 50ms API responses; actual login/render/request queue; SW blocked; readiness includes two rAF callbacks, not actual presented paint; forced GC after return",
  "samples": [
    {
      "run": 1,
      "entries": [
        {
          "visit": 1,
          "readyMs": 763,
          "renderMs": 401,
          "requests": 9,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 2,
      "entries": [
        {
          "visit": 1,
          "readyMs": 601,
          "renderMs": 273,
          "requests": 9,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 3,
      "entries": [
        {
          "visit": 1,
          "readyMs": 995,
          "renderMs": 498,
          "requests": 9,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 4,
      "entries": [
        {
          "visit": 1,
          "readyMs": 681,
          "renderMs": 347,
          "requests": 9,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 5,
      "entries": [
        {
          "visit": 1,
          "readyMs": 654,
          "renderMs": 231,
          "requests": 9,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "ai_analysis_history",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    }
  ]
}
```
### After samples
```json
{
  "conditions": "5 fresh Chromium sessions x1 detail entry; 365 prices, 10 saved decisions, 10 long AI histories; 390x844 CPU4x; synthetic 50ms API responses; actual login/render/request queue; SW blocked; readiness includes two rAF callbacks, not actual presented paint; forced GC after return",
  "samples": [
    {
      "run": 1,
      "entries": [
        {
          "visit": 1,
          "readyMs": 642,
          "renderMs": 239,
          "requests": 8,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 2,
      "entries": [
        {
          "visit": 1,
          "readyMs": 519,
          "renderMs": 238,
          "requests": 8,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 3,
      "entries": [
        {
          "visit": 1,
          "readyMs": 565,
          "renderMs": 265,
          "requests": 8,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 4,
      "entries": [
        {
          "visit": 1,
          "readyMs": 461,
          "renderMs": 236,
          "requests": 8,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    },
    {
      "run": 5,
      "entries": [
        {
          "visit": 1,
          "readyMs": 478,
          "renderMs": 231,
          "requests": 8,
          "requestNames": [
            "get_live_security_detail",
            "get_live_security_activity",
            "get_investment_thesis",
            "get_investment_decisions",
            "ai_analysis_history",
            "investment_breakout_rules",
            "get_live_decision_metrics",
            "get_investment_decisions"
          ],
          "documents": 2,
          "nodes": 3259,
          "jsEventListeners": 145
        }
      ]
    }
  ]
}
```
