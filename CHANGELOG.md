# 변경 이력

최신이 위. 형식: `날짜 [기능ID] 내용`

## 2026-10-26 (M3)
- [F011] 층 테마 구현: 테마 이름·진입 문구(테마 첫 층에만), "— 테마 —" 메시지, 팔레트 대체색, 테마별 방 설정 덮어쓰기(10층: 대기방 3~4개 + 큰 보스방). themes.json에 intro·rareChance 추가
- [systems] M3 시스템 확장 구현: effects.md 7절 면역(개체 정의·빌드 아이템, 통하지 않는다 메시지, 나중에 얻은 면역은 일시 효과 해제), 보스 2단계 보정 출처, game-state.md pendingChoice·bossKilled·보스 ai 필드, game-flow.md itemChoice phase와 클리어 판정(게임 오버 → 클리어 → 고르기)
- [systems] rng.md: loot 흐름은 층을 만든 뒤 그 층에 있는 동안 RunState.rng.loot에 이어 쓴다 (상자 후보, 몬스터 드롭)
- [tech] art-guide.md: 테마별 팔레트 기준색 (F011)

## 2026-10-26 (M2+)
- [F014, F015] status → implemented (M2+ 완료). tech-stack.md 테스트 지도 문자표에 새 몬스터 6종 추가. progress.md 갱신
- [F015] 전투 규칙 아이템 9종 데이터(items.json)와 그림 항목(sprites.json 대체 색) 추가, 완료 기준 테스트. 얻는 방법은 개발자 모드 아이템 생성 (드롭은 F005)
- [F014] 몬스터 다양화 구현: ranged(사격선·물러나기 두 턴에 한 번·사격 위치), flee(도망·도둑 사라짐), ambush(깨어나기), 몬스터 특성(슬라임·주술사 약화, 도둑 steal, 트롤 재생), 출현 가중치, chokepoint 배치, 처음 발견 메시지, 상태창 일시 효과. 새 몬스터 6종 데이터·색
- [systems] effects.md 확장 구현: 효과 출처 3종(개체 정의·빌드 아이템·일시 효과), onBeforeDamaged, 두 단계 피해 계산, ignoreDefense·cancelAttack·applyStatus·knockback·steal, 일시 효과(겹치지 않음, 걸린 턴 제외), attackRange(플레이어 최대 2), 확률 trigger 메시지·검사
- [systems] turn-order.md 확장 구현: 사거리 안 같은 줄 공격 판정, 턴 마무리 순서(onTurnEnd → 일시 효과 감소 → 죽은 몬스터 제거 → 시야 → 판정)
- [data] statuses.json 신규(weak, poison), player.json attackRange·maxAttackRange. items.json weight는 F005 확정 전까지 선택 항목
- [F012] 개발자 모드: 시드로 시작, 층 이동, 지도 공개, 아이템 생성, 상태 불러오기 추가 (무적은 아직)

## 2026-10-26
- [F003, F004, F006] status → implemented (M2 완료)
- [F014] 몬스터 다양화 설계안 신규 (draft): 원거리·겁쟁이·매복 행동, 몬스터 특성, 새 몬스터 6종, 일시 효과 2종
- [F005] 전투 규칙을 넘나드는 빌드 아이템 설계안 추가 (치명타·회피·2칸 공격·넉백·중독·관통)
- [F003] 전투 구현: 몬스터 방향 입력 = 공격, 피해 처리(effects.md), 전투 메시지, 처치 수, killedBy
- [F004] 몬스터 구현: spawn 흐름으로 방 안 배치(구조용 방 제외), 공통 시야 monsterSightRadius, chase(BFS 첫 걸음, 위→오른쪽→아래→왼쪽), lastSeenPlayer
- [systems] game-state.md: runStats.killedBy 추가 (F006 게임 오버 화면의 "{몬스터}에게 쓰러졌다")

## 2026-10-26 (M3 기획 확정)
- [F005] 누적형 + 후보 고르기(상자 3, 비밀방 2 희귀, 퍼즐 3), 등급 2단계, 빌드 아이템 20종(신규 11), 상자·보물상자방 최소 1개(1~9층), 바닥 소모품, 몬스터 드롭 8%, 후보 소진 시 물약 2개, 최대 HP 증가 시 현재 HP도 증가. status → confirmed
- [F008] 심연의 왕: 1칸, 보스방 안에서만 깨어남, 입장 경고·봉인, 힘 모으기→강타(십자 2칸 ×2), 2단계(50%, 공격 +2, 2턴마다), 면역(밀쳐내기·약화·훔치기), 클리어·게임 오버 화면에 빌드 목록. status → confirmed
- [F011] 테마 이름·진입 문구·팔레트, 테마별 rooms·bossRoom 덮어쓰기(10층 구조). status → confirmed
- [systems] effects.md 7절 면역, 보스 2단계 보정은 개체 정의 출처. game-state.md: pendingChoice, ItemChoice, bossKilled, 보스 ai 필드, sealedGate. game-flow.md: itemChoice phase, 클리어 판정 활성화. turn-order.md: 상자 interact, 보스방 경고 메시지 예외
- [F001] 테마의 방 설정 덮어쓰기 허용. [F009] 보물상자 규칙을 F005로 넘김. [vision] 세계관 한 줄
- [docs] roadmap M3 순서, glossary, progress
- [data] 데이터 파일 변경은 M3 구현 때 (문서에 형식 명시)

## 2026-10-26 (M2+ 기획 확정)
- [F014] 몬스터 다양화 확정: 원거리(사격 위치로 이동, 물러나기 두 턴에 한 번, 관통), 겁쟁이(steal로도 도망, vanishWhenUnseen), 매복(chokepoint 배치), 출현 가중치, 처음 발견 메시지, 특성 확률 금지, 몬스터 6종. status → confirmed
- [F015] 전투 규칙 아이템 신규 (F005 설계안에서 분리). 9종 확정, 명중 제외. status → confirmed
- [F005] 전투 아이템 절을 F015로 이동. 같은 빌드 아이템 한 판에 한 번만 나옴 확정
- [systems] effects.md: 능력치 attackRange(플레이어 상한 maxAttackRange), 효과 출처 3종과 실행 순서, onBeforeDamaged, 두 단계 피해 계산, 효과 ignoreDefense·cancelAttack·applyStatus·knockback·steal, 확률 trigger 메시지 필수, 몬스터·일시 효과 확률 금지, 일시 효과 규칙(겹치지 않음, 걸린 턴 제외), 공격이 아닌 피해의 처치 처리
- [systems] game-state.md: MonsterAi(noticed, awake, retreatedLastTurn, fleeing, unseenTurns), Actor.carried, Status.appliedTurn, killedBy에 일시 효과 id
- [systems] turn-order.md: 방향 입력 판정에 사거리 공격 추가, 턴 마무리 순서 세분화
- [docs] roadmap M2+ 추가 (F012 아이템 생성 먼저), glossary, progress
- [data] 데이터 파일 변경은 M2+ 구현 때 (문서에 형식 명시)

## 2026-10-22 (M2 기획 확정)
- [F004] 몬스터 시야를 "플레이어 시야 −1"에서 공통 고정값 monsterSightRadius(7)로 변경. 몬스터 위치에서 F002 방식 시야로 계산
- [data] monsters.json: sightOffsetFromPlayer → monsterSightRadius
- [F003] 규칙 확정. 기본 전투에 무작위 없음, 능력치 4종 유지, 전투 메시지 문구 추가. 회복은 물약뿐. status → confirmed
- [F004] 배치(방 안, 구조용 방 제외), 시야(플레이어 시야 −1, 플레이어가 보고 있을 때만), chase 행동(BFS, 위→오른쪽→아래→왼쪽), 속도 차이 없음, 강함 정보 표시 안 함. status → confirmed
- [F006] 이어하기 없음 확정, 게임 오버 화면에 시드·사인 추가. 클리어 판정은 F008 때. status → confirmed
- [data] monsters.json: 몬스터별 sightRadius 삭제, sightOffsetFromPlayer(−1)·behavior 추가 → 데이터 검사·타입 수정 필요
- [systems] effects.md: sightRadius는 플레이어 전용. turn-order.md: 몬스터 속도 미결정 해소
- [F009] 미결정 사항에 HP 회복 이벤트·환경 추가
- [docs] roadmap M2 범위 메모, progress.md 결정 목록 정리, glossary에 behavior·lastSeenPlayer

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
