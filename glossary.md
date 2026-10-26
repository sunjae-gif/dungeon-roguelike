# 용어 사전

문서와 코드에서 같은 것을 같은 이름으로 부르기 위한 표. 코드 이름은 변수·타입 이름에 쓴다.

| 용어 | 코드 이름 | 뜻 |
|---|---|---|
| 판 | run | 1층에서 시작해 죽거나 클리어할 때까지의 한 번의 플레이 |
| 층 | floor | 계단으로 이어진 지도 하나. 1~10층 |
| 테마 | theme | 층 묶음의 분위기와 설정. 1~3, 4~6, 7~9, 10층 |
| 칸 | tile | 지도의 한 격자. 지형은 `wall` 또는 `floor` 두 가지뿐 |
| 물체 | object | 칸 위에 놓인 상호작용 대상. 문, 숨은 벽, 함정, 상자, 계단 등 |
| 개체 | actor | 스스로 행동하는 것. 플레이어, 몬스터 |
| 화면 상태 | phase | title, playing, floorIntro, gameOver, victory |
| 능력치 | stat | maxHp, attack, defense, sightRadius |
| 보정 | modifier | 능력치에 더하거나 곱하는 값. 아이템·일시 효과에서 온다 |
| 이벤트 | event | 아이템 효과가 끼어드는 시점. onHit, onKill 등 |
| 효과 | effect | 이벤트나 아이템 사용 때 일어나는 일. heal, damage 등 |
| 일시 효과 | status | 정해진 턴 동안만 유지되는 효과 |
| 난수 흐름 | rngStream | 쓰임새별로 나눈 난수 생성기. map, spawn, combat 등 |
| 뷰포트 | viewport | 지도 중 화면에 보이는 부분. 25×17칸 |
| 카메라 | camera | 뷰포트의 왼쪽 위 칸 좌표. 플레이어를 따라가되 지도 밖은 보여주지 않는다 |
| 행동 방식 | behavior | 몬스터의 AI 종류. chase(추적), ranged(원거리), flee(겁쟁이), ambush(매복) |
| 사격선 | lineOfFire | 같은 가로·세로줄, 사거리 안, 사이가 막히지 않은 상태 (F014) |
| 사거리 | attackRange | 공격이 닿는 4방향 거리. 기본 1. 능력치 |
| 관통 | piercing | 원거리 공격이 다른 개체 너머로 날아감 (F014 해골 궁수) |
| 특성 | trait | 몬스터 정의에 적힌 modifiers·triggers. 몬스터 능력 |
| 매복 배치 | chokepoint | 방 입구 옆 칸에 놓는 배치 방식 (F014) |
| 훔친 물건 | carried | 몬스터가 steal로 가져간 아이템. 죽으면 떨어뜨린다 |
| 약화 | weak | 일시 효과. 공격 −2 |
| 중독 | poison | 일시 효과. 턴 끝마다 1 피해 |
| 회피 | cancelAttack | 공격을 무효로 만드는 효과. 아이템 전용 |
| 방어 관통 | ignoreDefense | 이번 공격은 대상 방어를 무시하는 효과 |
| 등급 | rarity | 빌드 아이템의 일반(common)·희귀(rare) |
| 아이템 고르기 | itemChoice | 빌드 아이템 후보 2~3개 중 하나를 고르는 화면(phase) |
| 고르기 대기 | pendingChoice | 상자를 연 뒤 턴 끝에 고르기 화면을 띄우기 위한 상태 |
| 보물상자방 | treasureRoom | 상자가 있는 방. 1~9층에 최소 1개 |
| 면역 | immunities | 특정 효과·일시 효과가 통하지 않는 성질 |
| 분노 | rage | 일시 효과. 공격 +2 (분노의 피) |
| 심연의 왕 | finalBoss | 10층 최종보스의 이름 |
| 힘 모으기 / 강타 | charge / slam | 보스가 다음 턴에 칠 칸을 표시하고, 그다음 차례에 그 칸을 2배 피해로 치는 패턴 |
| 봉인 | sealedGate | 보스방에 들어가면 입구를 막는 물체 |
| 2단계 | enraged | 보스 HP 절반 이하. 공격 +2, 힘 모으기가 빨라짐 |
| 샘 / 샘방 | spring | 한 번 마시면 최대 HP의 50% 회복하고 마르는 물체, 그것이 있는 방 (F009) |
| 숨은 벽 찾기 | — | 숨은 벽 옆에서 쉬기(Space). 확률 없음 (F009) |
| 막다른 통로 | deadEnd | 비밀방 입구에만 생기는 2~3칸짜리 끊긴 통로. 비밀방의 단서 |
| 퍼즐 판 | puzzle | puzzles.json에 손으로 그린 퍼즐 배치. 무너지는 발판(crumble), 돌 밀기(boulder) |
| 되돌림 레버 | lever | 퍼즐 판을 처음 상태로 돌리는 물체 |
| 잠긴 상자 | chest(locked) | 퍼즐을 풀어야 열리는 상자 |
| 경보 | alarm | 반경 안 몬스터를 그 칸으로 부르는 효과·함정 |
| 밀쳐내기 | knockback | 대상을 공격 방향으로 미는 효과. 막히면 충돌 피해 |
| 마지막 목격 위치 | lastSeenPlayer | 몬스터가 플레이어를 마지막으로 본 칸. 놓치면 그곳까지 간다 |
| 마일스톤 | milestone | roadmap.md의 구현 단계. M0~M5 |
| 방 | room | 바닥 칸이 모인 직사각형 영역 |
| 방 종류 | roomType | start, stairs, boss, normal, treasure, secret, puzzle |
| 보스방 | bossRoom | 10층에만 있는, 최종보스가 있는 방 |
| 비밀방 | secretRoom | 입구가 숨은 벽으로 가려진 방 |
| 퍼즐방 | puzzleRoom | 퍼즐을 풀면 보상이 나오는 방 |
| 보물상자방 | treasureRoom | 상자가 있는 방 |
| 통로 | corridor | 방과 방을 잇는 폭 1칸의 바닥 |
| 문 | door | 방과 통로 사이의 칸. 닫히면 이동·시야를 막는다 |
| 숨은 벽 | hiddenWall | 발견 전에는 벽과 같은, 비밀방 입구 |
| 함정 | trap | 밟으면 발동하는 바닥 물체 |
| 상자 | chest | 열면 아이템이 나오는 물체 |
| 계단 | stairs | 다음 층으로 가는 칸. 1~9층에만 있다 |
| 방향 | direction | 상하좌우 4개 중 하나. 대각선은 없다 |
| 4방향 거리 | manhattanDistance | `|dx| + |dy|`. 시야와 거리 계산에 쓴다 |
| 턴 | turn | 플레이어 행동 1번 + 모든 몬스터 행동 1번 |
| 행동 | action | 플레이어 입력을 게임 규칙이 이해하는 형태로 바꾼 것 |
| 시야 | sight / fov | 지금 보이는 칸들. 마름모 모양 |
| 탐색됨 | explored | 한 번이라도 본 적 있는 칸 |
| 소모품 | consumable | 쓰면 사라지는 아이템. 인벤토리 칸을 쓴다 |
| 빌드 아이템 | buildItem | 줍는 순간부터 판 끝까지 효과가 계속되는 아이템 |
| 빌드 | build | 한 판에서 모은 빌드 아이템의 조합 |
| 최종보스 | finalBoss | 10층 보스방의 몬스터. 쓰러뜨리면 클리어 |
| 클리어 | victory | 최종보스를 쓰러뜨려 판이 끝난 상태 |
| 게임 오버 | gameOver | 플레이어 HP가 0이 되어 판이 끝난 상태 |
| 스프라이트 | sprite | 인게임 픽셀아트 그림 하나. sprites.json의 id로 찾는다 |
| 스탠딩 일러스트 | illustration | 캐릭터 반신·전신 일러스트. sprites.json `illustrations` |
| 시드 | seed | 난수의 시작값. 같으면 같은 던전이 나온다 |
| 메시지 로그 | messageLog | 화면 아래의 행동 기록 |
| 당신 | — | 메시지에서 플레이어를 부르는 말. 예: "당신에게는 통하지 않는다." 주어를 생략할 수 있으면 생략한다 ("고블린에게 3 피해를 입혔다.") |
