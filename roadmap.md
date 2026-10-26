# 로드맵

구현 순서. 마일스톤 하나가 끝나면 브라우저에서 직접 확인할 수 있는 결과가 나온다.
Claude Code에게는 "M1 진행해줘"처럼 맡긴다. 마일스톤 안의 기능이 `confirmed`가 아니면 그 기능은 건너뛰고 알린다.

## M0. 뼈대
**결과:** 빈 화면에 "타이틀"이 뜨고, 데이터 파일을 불러오며, 테스트가 돈다.
- 프로젝트 생성 (40-tech/tech-stack.md)
- 데이터 불러오기와 검사 (tech-stack.md "데이터 검사")
- 상태 구조 (30-systems/game-state.md), 난수 (30-systems/rng.md), 화면 흐름 뼈대 (30-systems/game-flow.md)
- F012 개발자 모드의 창, 시드 표시, 상태 내보내기

## M1. 걸어 다닐 수 있는 던전
**결과:** 무작위 지도를 4방향으로 돌아다니며 시야가 밝혀지고, 계단으로 다음 층에 내려간다.
- F001 던전 생성 (기본 지형)
- F002 이동과 시야 (키 누르고 있기 포함)
- F007 화면 구성 (색 사각형 + Galmuri 글꼴)
- F013 계단과 층 이동
- 턴 순서 중 move, rest, descend (30-systems/turn-order.md)

M1의 범위 메모:
- 테마(F011)는 아직 draft다. M1은 themes.json에서 **지도 크기(`mapWidth`, `mapHeight`), 타일 그림 id(`tiles`), 테마 이름(`name`)만** 읽는다. 몬스터·아이템·방 가중치·함정 항목은 읽지 않는다.
- 10층에 내려가면 계단이 없는 층이 나온다. 보스방은 F001 규칙대로 만들지만 보스는 M3에서 넣는다.
- 상태창의 공격·방어는 player.json 기본값을 그대로 보여준다. (effects.md의 `getStat`은 M2에서 만들지만, 보정이 없으면 기본값과 같다)

## M2. 싸우고 죽을 수 있음
**결과:** 몬스터와 싸우고, 죽으면 게임 오버, R로 다시 시작.
- 30-systems/effects.md (능력치 계산, 이벤트, 피해 처리)
- F003 전투
- F004 몬스터
- F006 게임 종료와 재시작

M2의 범위 메모:
- 테마(F011)는 아직 draft지만, M2부터 themes.json의 `monsterTypes`, `monsterCount`도 읽는다(F004 배치).
- 10층 보스방에는 아직 보스를 놓지 않는다(F008). 클리어 판정도 아직 없다.
- monsters.json에서 몬스터별 `sightRadius`를 없애고 `monsterSightRadius`(공통 고정값), `behavior`를 추가했다. 데이터 검사 코드와 타입을 먼저 맞춘다.

## M2+. 몬스터와 전투 확장
**결과:** 원거리·겁쟁이·매복 몬스터가 나오고, 약화·중독이 걸리고, 전투 규칙 아이템 9종을 개발자 모드로 얻어 시험할 수 있다.
1. F012 개발자 모드 중 **아이템 생성** (먼저. 아이템 드롭(F005)이 없어서 이것 없이는 F015를 시험할 수 없다). 여유가 되면 층 이동도
2. 30-systems/effects.md 확장분: 효과 출처 3종, `onBeforeDamaged`, 두 단계 피해 계산, 효과 `ignoreDefense`·`cancelAttack`·`applyStatus`·`knockback`·`steal`, 일시 효과, `attackRange`
3. 30-systems/turn-order.md 확장분: 사거리 공격 판정, 턴 마무리 순서
4. F014 몬스터 다양화 (문서의 "구현 순서"대로)
5. F015 전투 규칙 아이템

M2+의 범위 메모:
- **데이터 파일(statuses.json 신규, monsters.json·themes.json·items.json·player.json 변경)은 기획 문서에 적힌 대로 구현할 때 만든다.** 데이터 검사 코드와 함께 바꿔야 테스트가 깨지지 않기 때문이다.
- themes.json `monsterTypes`는 F014 형식(가중치 객체)으로 바꾼다. F011은 아직 draft지만 이 항목만은 F014가 정한다.
- 아이템을 바닥·상자에서 얻는 것은 M3(F005).

## M3. 한 판 완주
**결과:** 1층부터 10층까지 내려가며 상자에서 빌드 아이템을 골라 모으고, 심연의 왕을 쓰러뜨리면 클리어.
1. 30-systems 확장분: effects.md 7절 면역, game-state.md(`pendingChoice`, `bossKilled`, 보스 ai 필드), game-flow.md(`itemChoice`, 클리어 판정)
2. F011 층 테마: 이름·진입 문구·팔레트, 테마별 방 설정 덮어쓰기(10층 구조)
3. F005 아이템: 바닥 소모품 → 몬스터 드롭 → 보물상자와 고르기 화면 → 새 빌드 아이템 11종
4. F008 최종보스: 배치 → 경고·봉인 → 강타 패턴 → 2단계 → 클리어 화면

M3의 범위 메모:
- 데이터 파일(loot.json 신규, items.json·statuses.json·monsters.json·themes.json·sprites.json·ui.json 변경)은 문서에 적힌 대로 구현하면서 데이터 검사와 함께 바꾼다.
- 보물상자방은 "층마다 최소 1개"만 F005가 구현한다. 가중치로 더 만드는 것, 비밀방·퍼즐방 보상은 M4(F009).

## M4. 탐색할 거리
**결과:** 층마다 방 구성이 다르고, 문·보이는 함정·보물상자방·비밀방·퍼즐방·샘방이 있다.
1. 시스템 확장분: game-state.md 물체별 state, turn-order.md(interact 종류, 몬스터 함정, 퍼즐 판정), effects.md `alarm`, rng.md 흐름 배정
2. F010 문과 함정: 문 → 함정 배치·발동 → 몬스터 길 찾기에서 함정 피하기 → 키 반복 멈춤
3. F009 방 종류: 가중치 배정 → 샘방 → 비밀방(막다른 통로, 쉬어서 찾기) → 퍼즐방(무너지는 발판 → 돌 밀기, 판 풀이 자동 테스트)

M4의 범위 메모:
- 데이터 파일(puzzles.json 신규, traps.json·rooms.json·themes.json·sprites.json·loot.json 변경)은 문서에 적힌 대로 구현하면서 데이터 검사와 함께 바꾼다.
- 퍼즐 판은 예시 2개 외에 최소 6종을 만든다. 각 판을 손으로 풀어 보고, 자동 풀이 테스트로도 확인한다.

## M5. 그림과 다듬기
**결과:** 픽셀아트와 일러스트가 들어간 화면.
- 이미지 파일 추가 (40-tech/art-guide.md)
- F007 다음 단계: 스탠딩 일러스트 위치, 창 크기 자동 확대, 이동 연출 (먼저 F007에 규칙 추가)
- 밸런스 조정 (20-data/ 수치)

## 마일스톤별로 먼저 확정할 것
| 마일스톤 | 아직 draft인 문서 |
|---|---|
| M0 | 없음 |
| M1 | 없음 (F001, F002, F007, F013 모두 confirmed) |
| M2 | 없음 (F003, F004, F006 모두 confirmed) |
| M2+ | 없음 (F012, F014, F015 모두 confirmed) |
| M3 | 없음 (F005, F008, F011 모두 confirmed) |
| M4 | 없음 (F009, F010 모두 confirmed) |
| M5 | art-guide.md |
