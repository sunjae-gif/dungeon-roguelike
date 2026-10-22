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
| `playing` | 턴 끝에 최종보스가 없음 (10층). **F008이 confirmed가 되기 전에는 판정하지 않는다** | `victory` |
| `gameOver`, `victory` | R | `floorIntro` (새 시드, 1층) |
| `gameOver`, `victory` | Esc | `title` |

## 규칙
1. phase는 `RunState.phase`에 둔다. 전환은 `core/flow.ts`의 함수 한 곳에서만 한다.
2. 게임 오버와 클리어 판정은 턴이 끝날 때 한 번만 한다(turn-order.md 6단계). 한 턴에 둘 다 해당하면 게임 오버가 우선한다.
   클리어 판정은 F008(최종보스)이 확정된 뒤에 넣는다. 그 전에는 보스가 없는 10층에서 바로 클리어되므로 판정하지 않는다.
3. 개발자 모드 창(F012)은 phase가 아니다. 어느 phase 위에든 겹쳐 열린다.
4. `floorIntro`의 시간 경과는 렌더 쪽 타이머가 처리하고, 전환 함수를 부르는 것만 한다.

## 완료 기준
- [ ] `playing`이 아닌 phase에서 이동 키를 눌러도 상태가 바뀌지 않는다.
- [ ] HP가 0이 되는 턴이 끝나면 phase가 `gameOver`다.
- [ ] 최종보스를 쓰러뜨린 턴이 끝나면 phase가 `victory`다. (F008 이후)
- [ ] `gameOver`에서 R을 누르면 floorNumber 1, 새 runSeed, phase `floorIntro`다.
