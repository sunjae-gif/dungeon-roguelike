# 변경 이력

최신이 위. 형식: `날짜 [기능ID] 내용`

## 2026-10-22
- [docs] progress.md 신규: 진행 현황과 결정할 것. CLAUDE.md에 갱신 규칙 추가
- [systems] effects.md 구현 (M2 중 확정된 부분): getStat, 이벤트·효과 실행(깊이 3 제한), 피해 처리 순서(resolveAttack), 일시 효과 감소. 턴에 onTurnStart·onMove·onTurnEnd·onFloorEnter 연결. 상태창·시야가 getStat 사용
- [F001] 방 연결을 "가장 가까운 이어진 방에 붙이기"로 바꿔 여러 방향으로 갈라지게 하고, extraCorridors만큼 고리 통로 추가 (구현)
- [systems] messageLog 100개 제한 구현
- [systems] game-flow.md: 클리어 판정은 F008 확정 전까지 하지 않는다
- [systems] turn-order.md: 무효 행동은 메시지를 남기지 않는다
- [systems] game-state.md: messageLog는 최대 ui.json `messageLogMaxStored`(100)개
- [F001] 여러 방향으로 갈라지는 연결, 고리 통로(dungeon.json `extraCorridors`), 통로 폭 1칸 초과 허용
- [F009] 시작방·계단방·보스방은 구조용 방으로 다른 종류를 겸하지 않음. 몬스터방을 후보에 추가
- [data] dungeon.json `extraCorridors`, ui.json `messageLogMaxStored` 추가

## 2026-10-21 (M1)
- [F001, F002, F007, F013] status → implemented (M1 완료)
- [F007] 1280×720 고정 캔버스, 지도(25×17칸·카메라)·상태창·메시지 로그, 탐색됨 어둡게, 색 사각형 대체, Galmuri11 글꼴(public/fonts, OFL) 구현. 공격·방어·최대 HP는 M2 getStat 전까지 player.json 기본값
- [F012] 시드 표시를 화면 구석에서 상태창 맨 아래로 옮김 (F007 규칙 21)
- [F013] 계단에서 >·Enter로 내려가기, 새 층 생성·시야·floorIntro, 계단·층 진입 메시지 구현
- [F002] 이동·쉬기·마름모 시야·탐색됨·키 누르고 있기 구현 (core/movement.ts, core/turn.ts, input/repeat.ts). 시야 반경은 M2의 getStat 전까지 player.json 기본값
- [systems] 턴 처리(turn.ts)의 move·rest. 클리어 판정은 F008 확정 전까지 하지 않도록 뺐다 (보스 없는 10층에서 바로 클리어되는 문제)
- [F001] 던전 생성 구현 (src/core/dungeon.ts). 방 배치 → 왼쪽부터 ㄱ자 통로 연결 → 시작·계단(또는 보스방). 시드 1000개 × 10층 테스트
- [data] dungeon.json `roomPlacementTries`(200) 추가: 한 번 생성할 때 방 자리를 뽑아 보는 횟수 (F001)
- [data] ui.json `colors.missingSprite` 추가: sprites.json에 없는 id를 그릴 때의 색 (F007)

## 2026-10-21 (M0)
- [M0] 프로젝트 생성: TypeScript + Vite + Vitest. `npm run dev` / `npm run build` / `npm test`
- [data] 데이터 불러오기와 검사 (src/data/). 필드·형식, id 중복, 파일 간 id 참조, 테마 floors 범위, effects.md 표 검사
- [systems] 상태 구조(src/core/state.ts), 난수 흐름(rng.ts), phase 전환(flow.ts) 구현. 층은 아직 테마 크기의 빈(벽) 지도이며 M1에서 F001로 바꾼다
- [F012] 개발자 창(` 키), 시드 표시, 상태 내보내기 구현. 시드로 시작·층 이동·지도 공개·무적·아이템 생성·상태 불러오기는 아직

## 2026-10-21 (2차)
- [F007] 화면 배치(1280×720, 지도 25×17칸, 오른쪽 상태창, 아래 로그 5줄), 카메라(따라가되 지도 끝에서 멈춤), 탐색됨 50% 어둡게, Galmuri 글꼴, 이동 연출 없음. status → confirmed
- [F002] 키 누르고 있기: 120ms마다 한 칸, 벽·새 몬스터·피해 시 멈춤
- [F013] 계단과 층 이동 신규 (F006에서 분리). status confirmed
- [F006] "게임 종료와 재시작"으로 축소
- [data] ui.json 신규 (화면 배치, 시야 표시, 글꼴, 입력 반복 수치)
- [docs] roadmap M1에 F013 추가, M1에서 쓰는 테마 항목 범위 명시. art-guide에 글꼴 추가

## 2026-10-21
- [systems] game-state.md 신규: 상태 구조, 칸/물체/개체 3층 모델. status confirmed
- [systems] rng.md 신규: 쓰임새별 난수 흐름 분리. status confirmed
- [systems] effects.md 신규: 능력치 보정, 이벤트 훅, 피해 처리 순서, 아이템 효과 데이터 형식. status confirmed
- [systems] game-flow.md 신규: phase와 전환. status confirmed
- [systems] turn-order.md 개편: 행동 종류, 이벤트 시점, 같은 턴 겹침 규칙. status confirmed
- [F012] 개발자 모드 신규. status confirmed
- [F010] 문·숨은 벽·함정을 칸 종류에서 물체로 변경
- [F003, F005] effects.md 참조. 문서 머리에 systems 필드 추가 (_template 포함)
- [data] items.json을 effects.md 형식으로 변경
- [tech] 데이터 검사 규칙, 문자 지도 테스트 규칙, src 폴더 추가
- [docs] roadmap.md 신규 (M0~M5). CLAUDE.md에 저장소 구조, 커밋 규칙, 시스템 문서 읽기 안내 추가

## 2026-10-20 (3차)
- [F001] 기본 지형만 다루도록 정리. 지도 크기는 테마별 설정으로. status → confirmed
- [F002] 4방향 좌표 정의, 마름모 시야(4방향 거리 + 브레젠험 직선 가림) 확정. status → confirmed
- [F003] 레벨·경험치 없음 확정. 나머지 규칙은 임시안
- [F005] "아이템과 빌드"로 개편. 소모품 / 빌드 아이템 두 갈래
- [F007] 픽셀아트 정수 확대, 스탠딩 일러스트 영역 추가
- [F009] 방 종류 신규 (일반, 보물상자, 비밀, 퍼즐 + 구조용 방)
- [F010] 문과 함정 신규
- [F011] 층 테마 신규 (1~3, 4~6, 7~9, 10층)
- [data] themes.json, rooms.json, traps.json 신규. dungeon.json의 층별 설정을 themes.json으로 이동. sprites.json에 테마 타일·물체·일러스트 추가
- [tech] art-guide.md 신규 (픽셀아트 / 스탠딩 일러스트 규격)
- [pillars] P3에 아이템 빌드, P4에 "알아챌 단서" 추가

## 2026-10-20 (2차)
- [vision] 그래픽은 생성 이미지, 탑뷰 4방향 이동, 클리어 조건(10층 최종보스 처치) 결정
- [F001] 10층은 계단 대신 보스방. 통로는 4방향으로만 연결
- [F002] 대각선 이동 없음 확정. 바라보는 방향 추가
- [F004] 몬스터도 4방향 이동·공격. 보스 관련 내용은 F008로 이동
- [F006] 클리어 조건을 최종보스 처치로 변경
- [F007] 탑뷰 타일 렌더링, sprites.json, 이미지 없을 때 색 사각형 대체 추가
- [F008] 최종보스 기능 문서 신규 작성

## 2026-10-20 (1차)
- [전체] 기획 문서 초안 작성. 모든 문서 `draft` 상태.
