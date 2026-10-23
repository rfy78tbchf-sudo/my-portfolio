# Build218 — 판단 입력에 집중하는 화면

Baseline: Build217 / c18bb9e7a8356b8f7312ce8d5ce08d1d2d066c04 (latest main verified).

- 판단 입력 중에는 지난 판단 카드, 보유 이유 미리보기, 진입 안내·버튼을 접고 판단 기록 폼을 우선한다. 저장이 실제 확인되어 폼이 닫히면 저장된 판단이 다시 보인다.
- 입력 제목/라벨을 판단 기록 / 내 선택 / 이유 / 다시 볼 조건으로 정리한다. 필드 간격과 입력 영역을 유지한다.
- 자동/직접 확인 조건의 설명은 조건 설정·도움말에 모은다. 7일·30일 빠른 선택과 날짜·가격·이평선 설정은 기존 처리로 연결한다.
- 비교가 필요한 판단의 선행 조건, 저장 요청 식별자, 서버 재조회 확인, 초안 보존, 재시도, 완료 후 목록 복귀는 변경하지 않는다. 키보드가 닫힌 기본 입력 화면에서는 하단 저장 하나만 표시한다. 글 입력 중에는 본문 저장을 사용하고 하단 버튼을 숨긴다. 하단이 없는 구성에서는 본문 저장을 유지한다.

## Validation

Existing isolated production-path browser save test now checks focused form at 390/402/430px in Chromium/WebKit, expandable help and confirmed summary restoration. It still verifies exact manual/comparison payloads, fresh-runtime readback, lost receipt and original-request retry without duplicate writes. Existing keyboard/reduced viewport, enlargement, filter/return, and refresh tests remain required.

Local save/recovery suite: 96 passed. Legacy Node dependencies run together without failures. Hosted mobile CI is required before main promotion. Test data and writes are intercepted synthetic responses; no real account records are created.

Physical iPhone keyboard, Face ID and home-screen app relaunch remain device checks.
