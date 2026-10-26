---
status: confirmed
---
# 화면 흐름

게임은 한 번에 하나의 화면 상태(`phase`)에 있다. 입력은 현재 phase가 처리하는 것만 받는다.

## phase 목록

| phase | 화면 | 받는 입력 |
|---|---|---|
| `title` | 타이틀. 새 게임, (개발자 모드면) 시드 입력 | Enter: 새 게임 |
| `playing` | 지도 + 상태창 + 메시지 로그 | 이동, 쉬기, 아이템 사용, 내려가기 |
| `floorIntro` | 새 층 진입 시 층 번호와 테마 이름을 잠깐 표시 (F013) | 아무 키 또는 ui.json `floorIntroMs` 뒤 자동으로 `playing` |
| `itemChoice` | 지도 위에 빌드 아이템 후보 2~3개와 효과 설명 (F005) | 숫자키 1~3: 고르기 |
| `gameOver` | 게임 오버 결과 (F006) | R: 새 판, Esc: 타이틀 |
| `victory` | 클리어 결과 (F006, F008) | R: 새 판, Esc: 타이틀 |

나중에 추가될 수 있는 phase: 퍼즐 전용 화면, 보스 등장 연출, 아이템 설명 화면. 추가할 때는 이 표와 아래 전환 표에 먼저 적는다.

## 전환

| 지금 | 조건 | 다음 |
|---|---|---|
| `title` | 새 게임 | `floorIntro` (1층) |
| `floorIntro` | 키 입력 또는 시간 경과 | `playing` |
| `playing` | 계단에서 내려가기 | `floorIntro` (다음 층) |
| `playing` | 턴 끝에 플레이어 HP ≤ 0 | `gameOver` |
| `playing` | 턴 끝에 `pendingChoice`가 있음 (게임 오버·클리어가 아닐 때) | `itemChoice` |
| `itemChoice` | 숫자키로 고름 (턴을 쓰지 않음) | `playing` |
| `playing` | 턴 끝에 `runStats.bossKilled`가 true (F008) | `victory` |
| `gameOver`, `victory` | R | `floorIntro` (새 시드, 1층) |
| `gameOver`, `victory` | Esc | `title` |

## 규칙
1. phase는 `RunState.phase`에 둔다. 전환은 `core/flow.ts`의 함수 한 곳에서만 한다.
2. 게임 오버와 클리어 판정은 턴이 끝날 때 한 번만 한다(turn-order.md 6단계). 한 턴에 둘 다 해당하면 게임 오버가 우선한다.
   판정 순서: 게임 오버 → 클리어 → 아이템 고르기.
3. 개발자 모드 창(F012)은 phase가 아니다. 어느 phase 위에든 겹쳐 열린다.
4. `floorIntro`의 시간 경과는 렌더 쪽 타이머가 처리하고, 전환 함수를 부르는 것만 한다.

## 완료 기준
- [ ] `playing`이 아닌 phase에서 이동 키를 눌러도 상태가 바뀌지 않는다.
- [ ] HP가 0이 되는 턴이 끝나면 phase가 `gameOver`다.
- [ ] 최종보스를 쓰러뜨린 턴이 끝나면 phase가 `victory`다.
- [ ] 상자를 연 턴이 끝나면 phase가 `itemChoice`이고, 이동 키를 눌러도 아무 일도 없다.
- [ ] `itemChoice`에서 1을 누르면 첫 번째 후보가 빌드 아이템에 추가되고 phase가 `playing`, 턴 수는 그대로다.
- [ ] `gameOver`에서 R을 누르면 floorNumber 1, 새 runSeed, phase `floorIntro`다.
