# Build197 — Preserve home continuity through a full refresh

Baseline: main 4a3efd8 / Build196. Full loadLiveOnce replaced the live target as soon as core balances arrived, initializing home performance and chart to null. Local retry retention from Build196 did not cover this gap.

Carry confirmed home fields into the new target only for the same auth owner, identical account ID set, Korean day, and selected period. Today's result has an independent day check. New core balances render immediately. Show “성과 갱신 중 · 이전 확인값 표시” while carried values await replacement; successful results remove the notice, and source failures use Build196's retained-field notice. If the enrichment lane itself fails, the pending notice becomes a failure with the existing home retry action. A restored different period discards carried period values before querying.

Baseline regression reproduced null chart while performance was delayed. Unit tests now pass new-balance visibility, retained values, successful replacement, failed chart retention and owner/account/day/period isolation. Existing startup races, local retention and loading recovery tests passed. Mobile test exercises the actual full loader with delayed reconciliation, checks unchanged period amount and visible chart, captures the pending home and verifies fresh completion removes the notice.

Mobile CI and production screenshot inspection pending. Synthetic fixtures only, no actual account writes. Physical iPhone verification and daily-use timing targets remain unverified. Next priority: inspect remaining visible gaps in daily home-to-performance usage rather than expanding analysis features.
