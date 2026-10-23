# Build217 — 내 종목에서 보유 현황과 내 판단으로

Baseline: Build216, main 48a58891e23452f2c3f47b96b4aa524f62d1e86b.

- 종목 상세를 보유 현황 → 내 판단 → 가격 차트 순서로 변경. 평가액, 수량, 평가손익, 통화가 표시된 매입가/잔고 가격을 먼저 읽는다.
- 저장된 최신 판단의 선택·이유·다시 볼 조건을 기본 화면으로 이동. 같은 보유 이유의 미리보기는 저장된 판단이 있는 경우 중복 노출하지 않는다. 원문 보유 이유는 바로가기에서 확인한다.
- 기록이 없는 종목은 보유 이유와 직접 판단 입력을 유지. 지난 판단 이후 변화, 비교, 저장·재시도·재열람 및 목록 복귀는 기존 핸들러를 사용한다.
- 목록 우측 기준을 평가액 / 평가손익으로 명확히 표시한다. 검색·정렬·계좌·시장과 밀도는 유지한다.
- 큰 금액과 확대 화면에서 상세 숫자가 줄바꿈 가능하도록 정리한다. 원래 가격의 통화와 환산 표시는 유지한다.

## Verification

Synthetic browser fixture: tests/build217_browser.mjs, Chromium and WebKit, 390/402/430px, 125% enlargement, saved and first-decision entry, return, no writes. Existing CI decision-save, recovery, price, filter and visual tests remain required before main promotion.

Old visual ordering expectations now assert detailOverview first; save/readback assertions remain unchanged. Three isolated decision DOM fixtures now include the existing detailStartHint node used by the relocated summary.

No real account writes, schema changes, new AI features or order execution. Physical iPhone keyboard, Face ID and PWA relaunch are not certified by browser checks.
